import React, { useState, useRef, useEffect } from 'react';
import { Undo, Redo, Eye, EyeOff, Trash2, Ruler, Edit3, FolderOpen, MapPin, FileText, ZoomIn, Move, Layers, Plus, X, Scissors } from 'lucide-react';

const LandAreaCalculator = () => {
    const [screen, setScreen] = useState('dashboard');
    const [image, setImage] = useState(null);
    const [vertices, setVertices] = useState([]);
    const [calibrationPoints, setCalibrationPoints] = useState([]);
    const [calibrationDistance, setCalibrationDistance] = useState('');
    const [pixelsPerFoot, setPixelsPerFoot] = useState(null);
    const [mode, setMode] = useState('zoom'); // points, zoom, calibrate, split
    const [splitPoints, setSplitPoints] = useState([]);
    const [splitTargetPolygon, setSplitTargetPolygon] = useState(null);
    const [showLabels, setShowLabels] = useState(true);
    const [polygons, setPolygons] = useState([]);
    const [currentPolygonLabel, setCurrentPolygonLabel] = useState('');
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [layers, setLayers] = useState([{ id: 1, name: 'Layer 1', vertices: [], polygons: [], visible: true, color: '#2196F3' }]);
    const [activeLayerId, setActiveLayerId] = useState(1);
    const [showLayerPanel, setShowLayerPanel] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [draggedVertexIndex, setDraggedVertexIndex] = useState(null);
    const [draggedPolygonId, setDraggedPolygonId] = useState(null);
    const canvasRef = useRef(null);
    const imageRef = useRef(null);
    const fileInputRef = useRef(null);

    // Get active layer
    const activeLayer = layers.find(l => l.id === activeLayerId);

    // Update active layer
    const updateActiveLayer = (updates) => {
        setLayers(layers.map(l =>
            l.id === activeLayerId ? { ...l, ...updates } : l
        ));
    };

    // Add new layer
    const addNewLayer = () => {
        const newId = Math.max(...layers.map(l => l.id)) + 1;
        const colors = ['#2196F3', '#4CAF50', '#FF9800', '#9C27B0', '#F44336', '#00BCD4'];
        const newLayer = {
            id: newId,
            name: `Layer ${newId}`,
            vertices: [],
            polygons: [],
            visible: true,
            color: colors[newId % colors.length]
        };
        setLayers([...layers, newLayer]);
        setActiveLayerId(newId);
    };

    // Delete layer
    const deleteLayer = (layerId) => {
        if (layers.length === 1) return; // Keep at least one layer
        setLayers(layers.filter(l => l.id !== layerId));
        if (activeLayerId === layerId) {
            setActiveLayerId(layers[0].id);
        }
    };

    // Toggle layer visibility
    const toggleLayerVisibility = (layerId) => {
        setLayers(layers.map(l =>
            l.id === layerId ? { ...l, visible: !l.visible } : l
        ));
    };

    // Calculate distance between two points
    const getDistance = (p1, p2) => {
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    };

    // Calculate area using Shoelace formula
    const calculateArea = (points) => {
        if (points.length < 3) return 0;
        let area = 0;
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            area += points[i].x * points[j].y;
            area -= points[j].x * points[i].y;
        }
        return Math.abs(area / 2);
    };

    // Calculate perimeter
    const calculatePerimeter = (points) => {
        if (points.length < 2) return 0;
        let perimeter = 0;
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            perimeter += getDistance(points[i], points[j]);
        }
        return perimeter;
    };

    // Convert pixels to feet
    const pixelsToFeet = (pixels) => {
        if (!pixelsPerFoot) return pixels;
        return pixels / pixelsPerFoot;
    };

    // Add to history
    const addToHistory = (state) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push({ layers: JSON.parse(JSON.stringify(state)) });
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    };

    // Undo
    const undo = () => {
        if (historyIndex > 0) {
            setHistoryIndex(historyIndex - 1);
            const state = history[historyIndex - 1];
            setLayers(JSON.parse(JSON.stringify(state.layers)));
        }
    };

    // Redo
    const redo = () => {
        if (historyIndex < history.length - 1) {
            setHistoryIndex(historyIndex + 1);
            const state = history[historyIndex + 1];
            setLayers(JSON.parse(JSON.stringify(state.layers)));
        }
    };

    // Handle image upload
    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setImage(event.target.result);
                setScreen('canvas');
                const initialLayer = { id: 1, name: 'Layer 1', vertices: [], polygons: [], visible: true, color: '#2196F3' };
                setLayers([initialLayer]);
                setActiveLayerId(1);
                setCalibrationPoints([]);
                setPixelsPerFoot(null);
                setHistory([{ layers: [initialLayer] }]);
                setHistoryIndex(0);
                setMode('zoom');
            };
            reader.readAsDataURL(file);
        }
    };

    // Get canvas coordinates from mouse event
    const getCanvasCoords = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - pan.x) / zoom;
        const y = (e.clientY - rect.top - pan.y) / zoom;
        return { x, y };
    };

    // Check if click is on a line segment
    const findNearbyLineSegment = (x, y, threshold = 8) => {
        if (!activeLayer) return null;

        // Check current vertices
        for (let i = 0; i < activeLayer.vertices.length - 1; i++) {
            const p1 = activeLayer.vertices[i];
            const p2 = activeLayer.vertices[i + 1];
            const dist = pointToLineDistance({ x, y }, p1, p2);
            if (dist < threshold / zoom) {
                return { type: 'current', index: i + 1, layerId: activeLayerId };
            }
        }

        // Check polygons
        for (let polygon of activeLayer.polygons) {
            for (let i = 0; i < polygon.vertices.length; i++) {
                const p1 = polygon.vertices[i];
                const p2 = polygon.vertices[(i + 1) % polygon.vertices.length];
                const dist = pointToLineDistance({ x, y }, p1, p2);
                if (dist < threshold / zoom) {
                    return { type: 'polygon', polygonId: polygon.id, index: i + 1, layerId: activeLayerId, polygon: polygon };
                }
            }
        }

        return null;
    };

    // Calculate distance from point to line segment
    const pointToLineDistance = (point, lineStart, lineEnd) => {
        const { x, y } = point;
        const { x: x1, y: y1 } = lineStart;
        const { x: x2, y: y2 } = lineEnd;

        const A = x - x1;
        const B = y - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;

        if (lenSq !== 0) param = dot / lenSq;

        let xx, yy;

        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        const dx = x - xx;
        const dy = y - yy;
        return Math.sqrt(dx * dx + dy * dy);
    };

    // Check if click is near a vertex
    const findNearbyVertex = (x, y, threshold = 10) => {
        // Check current layer vertices
        if (activeLayer) {
            for (let i = 0; i < activeLayer.vertices.length; i++) {
                const dist = getDistance({ x, y }, activeLayer.vertices[i]);
                if (dist < threshold / zoom) {
                    return { type: 'current', index: i, layerId: activeLayerId };
                }
            }

            // Check active layer polygons
            for (let polygon of activeLayer.polygons) {
                for (let i = 0; i < polygon.vertices.length; i++) {
                    const dist = getDistance({ x, y }, polygon.vertices[i]);
                    if (dist < threshold / zoom) {
                        return { type: 'polygon', polygonId: polygon.id, index: i, layerId: activeLayerId, polygon: polygon };
                    }
                }
            }
        }

        return null;
    };

    // Split polygon into two parts
    const splitPolygon = (polygon, point1Index, point2Index) => {
        const vertices = polygon.vertices;

        // Ensure point1 comes before point2 in the array
        let [startIdx, endIdx] = point1Index < point2Index ? [point1Index, point2Index] : [point2Index, point1Index];

        // Create first polygon (from startIdx to endIdx)
        const polygon1Vertices = [];
        for (let i = startIdx; i <= endIdx; i++) {
            polygon1Vertices.push(vertices[i]);
        }

        // Create second polygon (from endIdx to startIdx, wrapping around)
        const polygon2Vertices = [];
        for (let i = endIdx; i < vertices.length; i++) {
            polygon2Vertices.push(vertices[i]);
        }
        for (let i = 0; i <= startIdx; i++) {
            polygon2Vertices.push(vertices[i]);
        }

        // Only create valid polygons (3+ vertices)
        const newPolygons = [];
        if (polygon1Vertices.length >= 3) {
            newPolygons.push({
                vertices: polygon1Vertices,
                label: `${polygon.label} - Part A`,
                id: Date.now()
            });
        }
        if (polygon2Vertices.length >= 3) {
            newPolygons.push({
                vertices: polygon2Vertices,
                label: `${polygon.label} - Part B`,
                id: Date.now() + 1
            });
        }

        return newPolygons;
    };

    // Handle mouse down
    const handleMouseDown = (e) => {
        if (!image) return;
        const { x, y } = getCanvasCoords(e);

        if (mode === 'zoom') {
            setIsDragging(true);
            setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        } else if (mode === 'points') {
            const nearby = findNearbyVertex(x, y);
            if (nearby) {
                setDraggedVertexIndex(nearby.index);
                setDraggedPolygonId(nearby.type === 'polygon' ? nearby.polygonId : null);
            }
        }
    };

    // Handle mouse move
    const handleMouseMove = (e) => {
        if (mode === 'zoom' && isDragging) {
            setPan({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            });
        } else if (mode === 'points' && draggedVertexIndex !== null && activeLayer) {
            const { x, y } = getCanvasCoords(e);

            if (draggedPolygonId !== null) {
                // Dragging polygon vertex
                updateActiveLayer({
                    polygons: activeLayer.polygons.map(p => {
                        if (p.id === draggedPolygonId) {
                            const newVertices = [...p.vertices];
                            newVertices[draggedVertexIndex] = { x, y };
                            return { ...p, vertices: newVertices };
                        }
                        return p;
                    })
                });
            } else {
                // Dragging current drawing vertex
                const newVertices = [...activeLayer.vertices];
                newVertices[draggedVertexIndex] = { x, y };
                updateActiveLayer({ vertices: newVertices });
            }
        }
    };

    // Handle mouse up
    const handleMouseUp = () => {
        if (draggedVertexIndex !== null) {
            addToHistory(layers);
        }
        setIsDragging(false);
        setDraggedVertexIndex(null);
        setDraggedPolygonId(null);
    };

    // Handle canvas click
    const handleCanvasClick = (e) => {
        if (!image || !activeLayer) return;

        // Don't add point if we were dragging
        if (isDragging || draggedVertexIndex !== null) return;

        const { x, y } = getCanvasCoords(e);

        if (mode === 'calibrate') {
            const newPoints = [...calibrationPoints, { x, y }];
            setCalibrationPoints(newPoints);

            if (newPoints.length === 2) {
                const dist = getDistance(newPoints[0], newPoints[1]);
                const feet = parseFloat(calibrationDistance);
                if (feet && feet > 0) {
                    setPixelsPerFoot(dist / feet);
                    setMode('points');
                    setCalibrationPoints([]);
                }
            }
        } else if (mode === 'split') {
            // Split mode - select vertices from existing polygons only
            const nearby = findNearbyVertex(x, y, 15); // Larger threshold for easier selection

            console.log('Split mode click:', nearby); // Debug

            if (nearby && nearby.type === 'polygon') {
                console.log('Found polygon vertex:', nearby); // Debug

                // If this is the first point, store the target polygon
                if (splitPoints.length === 0) {
                    setSplitTargetPolygon(nearby.polygon);
                    setSplitPoints([nearby]);
                }
                // If selecting second point
                else if (splitPoints.length === 1) {
                    // Check if both points are from the same polygon
                    if (splitPoints[0].polygonId === nearby.polygonId &&
                        splitPoints[0].index !== nearby.index) {
                        const polygon = splitTargetPolygon;
                        const newPolygons = splitPolygon(polygon, splitPoints[0].index, nearby.index);

                        console.log('Splitting polygon:', newPolygons); // Debug

                        // Remove original polygon and add split polygons
                        const updatedPolygons = activeLayer.polygons.filter(p => p.id !== polygon.id).concat(newPolygons);
                        updateActiveLayer({ polygons: updatedPolygons });
                        addToHistory(layers.map(l =>
                            l.id === activeLayerId ? { ...l, polygons: updatedPolygons } : l
                        ));

                        // Reset split mode
                        setSplitPoints([]);
                        setSplitTargetPolygon(null);
                        setMode('points');
                    } else {
                        // If points are from different polygons or same vertex, reset and start over
                        console.log('Invalid second point, resetting'); // Debug
                        setSplitTargetPolygon(nearby.polygon);
                        setSplitPoints([nearby]);
                    }
                }
            } else {
                console.log('No polygon vertex found'); // Debug
            }
        } else if (mode === 'points') {
            // Check if clicking near existing vertex (don't add new point)
            const nearbyVertex = findNearbyVertex(x, y);
            if (nearbyVertex) {
                // Don't add point if clicking on existing vertex
                return;
            }

            // Check if clicking on a line segment
            const nearbyLine = findNearbyLineSegment(x, y);
            if (nearbyLine) {
                // Insert point into the line at the clicked position
                if (nearbyLine.type === 'current') {
                    const newVertices = [...activeLayer.vertices];
                    newVertices.splice(nearbyLine.index, 0, { x, y });
                    updateActiveLayer({ vertices: newVertices });
                    addToHistory(layers.map(l =>
                        l.id === activeLayerId ? { ...l, vertices: newVertices } : l
                    ));
                } else if (nearbyLine.type === 'polygon') {
                    // Insert point into polygon
                    const updatedPolygons = activeLayer.polygons.map(p => {
                        if (p.id === nearbyLine.polygonId) {
                            const newVertices = [...p.vertices];
                            newVertices.splice(nearbyLine.index, 0, { x, y });
                            return { ...p, vertices: newVertices };
                        }
                        return p;
                    });
                    updateActiveLayer({ polygons: updatedPolygons });
                    addToHistory(layers.map(l =>
                        l.id === activeLayerId ? { ...l, polygons: updatedPolygons } : l
                    ));
                }
            } else {
                // Add new point at the end
                const newVertices = [...activeLayer.vertices, { x, y }];
                updateActiveLayer({ vertices: newVertices });
                addToHistory(layers.map(l =>
                    l.id === activeLayerId ? { ...l, vertices: newVertices } : l
                ));
            }
        }
    };

    // Handle wheel for zoom
    const handleWheel = (e) => {
        e.preventDefault();
        if (mode === 'zoom') {
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            setZoom(prev => Math.max(0.1, Math.min(5, prev * delta)));
        }
    };

    // Close polygon
    const closePolygon = () => {
        if (!activeLayer || activeLayer.vertices.length < 3) return;

        const newPolygon = {
            vertices: [...activeLayer.vertices],
            label: currentPolygonLabel || `Plot ${activeLayer.polygons.length + 1}`,
            id: Date.now()
        };

        const newPolygons = [...activeLayer.polygons, newPolygon];
        updateActiveLayer({ vertices: [], polygons: newPolygons });
        setCurrentPolygonLabel('');
        addToHistory(layers.map(l =>
            l.id === activeLayerId ? { ...l, vertices: [], polygons: newPolygons } : l
        ));
    };

    // Clear current drawing
    const clearCurrent = () => {
        if (!activeLayer) return;
        updateActiveLayer({ vertices: [] });
        addToHistory(layers.map(l =>
            l.id === activeLayerId ? { ...l, vertices: [] } : l
        ));
    };

    // Draw on canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !image) return;

        const ctx = canvas.getContext('2d');
        const img = imageRef.current;

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            ctx.save();
            ctx.translate(pan.x, pan.y);
            ctx.scale(zoom, zoom);

            // Draw image
            if (img && img.complete) {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            }

            // Draw all layers
            layers.forEach((layer) => {
                if (!layer.visible) return;

                const isActive = layer.id === activeLayerId;
                const layerColor = layer.color;

                // Draw completed polygons in this layer
                layer.polygons.forEach((polygon) => {
                    ctx.beginPath();
                    ctx.fillStyle = layerColor.replace(')', ', 0.2)').replace('rgb', 'rgba').replace('#', 'rgba(');
                    // Convert hex to rgba
                    const r = parseInt(layerColor.slice(1, 3), 16);
                    const g = parseInt(layerColor.slice(3, 5), 16);
                    const b = parseInt(layerColor.slice(5, 7), 16);
                    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.2)`;
                    ctx.strokeStyle = layerColor;
                    ctx.lineWidth = 2 / zoom;

                    polygon.vertices.forEach((vertex, i) => {
                        if (i === 0) ctx.moveTo(vertex.x, vertex.y);
                        else ctx.lineTo(vertex.x, vertex.y);
                    });
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();

                    // Draw vertices - highlight them larger in split mode
                    polygon.vertices.forEach((vertex, i) => {
                        ctx.beginPath();
                        const vertexSize = mode === 'split' && isActive ? 8 / zoom : 5 / zoom;
                        ctx.arc(vertex.x, vertex.y, vertexSize, 0, Math.PI * 2);

                        // Highlight selected split points
                        let isSelected = false;
                        if (mode === 'split' && isActive) {
                            isSelected = splitPoints.some(sp =>
                                sp.polygonId === polygon.id && sp.index === i
                            );
                        }

                        // Use bright colors for better visibility
                        if (isSelected) {
                            ctx.fillStyle = '#FF0000'; // Bright red for selected
                            ctx.strokeStyle = '#FFFF00'; // Yellow border
                            ctx.lineWidth = 3 / zoom;
                        } else if (mode === 'split' && isActive) {
                            ctx.fillStyle = layerColor;
                            ctx.strokeStyle = '#FFD700'; // Gold border in split mode
                            ctx.lineWidth = 2 / zoom;
                        } else {
                            ctx.fillStyle = layerColor;
                            ctx.strokeStyle = '#fff';
                            ctx.lineWidth = 1 / zoom;
                        }

                        ctx.fill();
                        ctx.stroke();
                    });

                    // Draw label
                    if (showLabels) {
                        const centerX = polygon.vertices.reduce((sum, v) => sum + v.x, 0) / polygon.vertices.length;
                        const centerY = polygon.vertices.reduce((sum, v) => sum + v.y, 0) / polygon.vertices.length;

                        const areaPixels = calculateArea(polygon.vertices);
                        const perimeterPixels = calculatePerimeter(polygon.vertices);
                        const areaSqFt = pixelsToFeet(pixelsToFeet(areaPixels));
                        const perimeterFt = pixelsToFeet(perimeterPixels);

                        ctx.fillStyle = '#000';
                        ctx.font = `bold ${14 / zoom}px Arial`;
                        ctx.textAlign = 'center';
                        ctx.fillText(polygon.label, centerX, centerY - 20 / zoom);
                        ctx.font = `${12 / zoom}px Arial`;
                        ctx.fillText(`Area: ${areaSqFt.toFixed(2)} sq ft`, centerX, centerY);
                        ctx.fillText(`Perimeter: ${perimeterFt.toFixed(2)} ft`, centerX, centerY + 15 / zoom);
                    }
                });

                // Draw current polygon for active layer
                if (isActive && layer.vertices.length > 0) {
                    ctx.beginPath();
                    const r = parseInt(layerColor.slice(1, 3), 16);
                    const g = parseInt(layerColor.slice(3, 5), 16);
                    const b = parseInt(layerColor.slice(5, 7), 16);
                    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.2)`;
                    ctx.strokeStyle = layerColor;
                    ctx.lineWidth = 2 / zoom;

                    layer.vertices.forEach((vertex, i) => {
                        if (i === 0) ctx.moveTo(vertex.x, vertex.y);
                        else ctx.lineTo(vertex.x, vertex.y);
                    });

                    if (layer.vertices.length > 2) {
                        ctx.closePath();
                        ctx.fill();
                    }
                    ctx.stroke();

                    // Draw vertices with larger hit area in points mode
                    layer.vertices.forEach((vertex, i) => {
                        ctx.beginPath();
                        ctx.arc(vertex.x, vertex.y, 6 / zoom, 0, Math.PI * 2);
                        ctx.fillStyle = i === 0 ? '#FF5722' : layerColor;
                        ctx.fill();
                        ctx.strokeStyle = '#fff';
                        ctx.lineWidth = 2 / zoom;
                        ctx.stroke();
                    });
                }
            });

            // Draw calibration line
            if (calibrationPoints.length > 0) {
                ctx.strokeStyle = '#FF9800';
                ctx.lineWidth = 3 / zoom;
                ctx.beginPath();
                ctx.moveTo(calibrationPoints[0].x, calibrationPoints[0].y);
                if (calibrationPoints.length === 2) {
                    ctx.lineTo(calibrationPoints[1].x, calibrationPoints[1].y);
                }
                ctx.stroke();

                calibrationPoints.forEach((point) => {
                    ctx.beginPath();
                    ctx.arc(point.x, point.y, 6 / zoom, 0, Math.PI * 2);
                    ctx.fillStyle = '#FF9800';
                    ctx.fill();
                });
            }

            // Draw split line preview
            if (mode === 'split' && splitPoints.length === 1 && splitTargetPolygon) {
                const firstPoint = splitTargetPolygon.vertices[splitPoints[0].index];
                ctx.strokeStyle = '#FF5722';
                ctx.lineWidth = 3 / zoom;
                ctx.setLineDash([5 / zoom, 5 / zoom]);
                ctx.beginPath();
                ctx.moveTo(firstPoint.x, firstPoint.y);
                // Draw to mouse position would require tracking, so just show the selected point
                ctx.stroke();
                ctx.setLineDash([]);
            }

            ctx.restore();
        };

        draw();
    }, [image, layers, activeLayerId, calibrationPoints, showLabels, pixelsPerFoot, zoom, pan, mode, splitPoints]);

    // Get current stats
    const getCurrentStats = () => {
        if (!activeLayer || activeLayer.vertices.length < 2) return { distance: 0, area: 0, perimeter: 0 };

        const areaPixels = calculateArea(activeLayer.vertices);
        const perimeterPixels = calculatePerimeter(activeLayer.vertices);
        const lastDistance = activeLayer.vertices.length >= 2 ?
            getDistance(activeLayer.vertices[activeLayer.vertices.length - 2], activeLayer.vertices[activeLayer.vertices.length - 1]) : 0;

        return {
            distance: pixelsToFeet(lastDistance).toFixed(2),
            area: pixelsToFeet(pixelsToFeet(areaPixels)).toFixed(2),
            perimeter: pixelsToFeet(perimeterPixels).toFixed(2)
        };
    };

    const stats = getCurrentStats();

    if (screen === 'dashboard') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-4xl font-bold text-gray-800 mb-2 text-center">Land Area Calculator</h1>
                    <p className="text-gray-600 text-center mb-8">Measure land areas with precision</p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow flex flex-col items-center justify-center space-y-4 group"
                        >
                            <div className="bg-blue-100 p-6 rounded-full group-hover:bg-blue-200 transition-colors">
                                <MapPin className="w-12 h-12 text-blue-600" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-800">Draw on Image</h3>
                            <p className="text-gray-600 text-center text-sm">Upload a map image and start measuring</p>
                        </button>

                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow flex flex-col items-center justify-center space-y-4 group"
                        >
                            <div className="bg-green-100 p-6 rounded-full group-hover:bg-green-200 transition-colors">
                                <FileText className="w-12 h-12 text-green-600" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-800">Draw on PDF</h3>
                            <p className="text-gray-600 text-center text-sm">Import PDF documents for measurement</p>
                        </button>

                        <button
                            className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow flex flex-col items-center justify-center space-y-4 group"
                        >
                            <div className="bg-purple-100 p-6 rounded-full group-hover:bg-purple-200 transition-colors">
                                <FolderOpen className="w-12 h-12 text-purple-600" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-800">Saved Data</h3>
                            <p className="text-gray-600 text-center text-sm">Access your saved measurements</p>
                        </button>
                    </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleImageUpload}
                        className="hidden"
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-gray-100">
            {/* Header */}
            <div className="bg-white shadow-md px-4 py-3 flex items-center justify-between">
                <button
                    onClick={() => setScreen('dashboard')}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                >
                    ← Back
                </button>

                <div className="flex items-center space-x-6 text-sm">
                    <div className="flex items-center space-x-2">
                        <span className="text-gray-600">Distance:</span>
                        <span className="font-semibold text-gray-800">{stats.distance} ft</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <span className="text-gray-600">Area:</span>
                        <span className="font-semibold text-gray-800">{stats.area} sq ft</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <span className="text-gray-600">Perimeter:</span>
                        <span className="font-semibold text-gray-800">{stats.perimeter} ft</span>
                    </div>
                </div>

                <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">Zoom: {(zoom * 100).toFixed(0)}%</span>
                </div>
            </div>

            {/* Toolbar */}
            <div className="bg-white border-b px-4 py-2 flex items-center space-x-2">
                {/* Mode Toggle Buttons */}
                <div className="flex items-center bg-gray-100 rounded-lg p-1 space-x-1">
                    <button
                        onClick={() => setMode('points')}
                        className={`px-4 py-2 rounded flex items-center space-x-2 transition-colors ${mode === 'points' ? 'bg-blue-600 text-white shadow' : 'text-gray-700 hover:bg-gray-200'
                            }`}
                        title="Points Mode - Click to add/drag vertices"
                    >
                        <Edit3 className="w-4 h-4" />
                        <span className="font-medium">Points</span>
                    </button>

                    <button
                        onClick={() => setMode('zoom')}
                        className={`px-4 py-2 rounded flex items-center space-x-2 transition-colors ${mode === 'zoom' ? 'bg-green-600 text-white shadow' : 'text-gray-700 hover:bg-gray-200'
                            }`}
                        title="Zoom Mode - Scroll to zoom, drag to pan"
                    >
                        <Move className="w-4 h-4" />
                        <span className="font-medium">Zoom</span>
                    </button>
                </div>

                <div className="border-l h-6 mx-2"></div>

                <button
                    onClick={() => {
                        setMode('calibrate');
                        setCalibrationPoints([]);
                    }}
                    className={`px-3 py-2 rounded hover:bg-gray-100 flex items-center space-x-2 ${mode === 'calibrate' ? 'bg-orange-100 text-orange-700' : ''
                        }`}
                    title="Calibrate Scale"
                >
                    <Ruler className="w-5 h-5" />
                    <span className="text-sm font-medium">Calibrate</span>
                </button>

                <button
                    onClick={() => {
                        setMode('split');
                        setSplitPoints([]);
                        setSplitTargetPolygon(null);
                    }}
                    className={`px-3 py-2 rounded hover:bg-gray-100 flex items-center space-x-2 ${mode === 'split' ? 'bg-red-100 text-red-700' : ''
                        }`}
                    title="Split Area - Select 2 vertices from a polygon"
                >
                    <Scissors className="w-5 h-5" />
                    <span className="text-sm font-medium">Split Area</span>
                </button>

                {mode === 'calibrate' && (
                    <input
                        type="number"
                        placeholder="Distance (ft)"
                        value={calibrationDistance}
                        onChange={(e) => setCalibrationDistance(e.target.value)}
                        className="px-3 py-2 border rounded w-32 text-sm"
                    />
                )}

                {mode === 'split' && (
                    <div className="flex items-center space-x-2">
                        <div className="px-3 py-2 bg-red-50 rounded text-sm text-red-700 font-medium">
                            {splitPoints.length === 0 ? '🔴 Click first vertex on a polygon' : '🟡 Click second vertex on same polygon'}
                        </div>
                        <button
                            onClick={() => {
                                setSplitPoints([]);
                                setSplitTargetPolygon(null);
                                setMode('points');
                            }}
                            className="px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm font-medium"
                        >
                            Cancel Split
                        </button>
                    </div>
                )}

                <div className="border-l h-6 mx-2"></div>

                <button
                    onClick={undo}
                    disabled={historyIndex <= 0}
                    className="p-2 rounded hover:bg-gray-100 disabled:opacity-30"
                    title="Undo"
                >
                    <Undo className="w-5 h-5" />
                </button>

                <button
                    onClick={redo}
                    disabled={historyIndex >= history.length - 1}
                    className="p-2 rounded hover:bg-gray-100 disabled:opacity-30"
                    title="Redo"
                >
                    <Redo className="w-5 h-5" />
                </button>

                <div className="border-l h-6 mx-2"></div>

                <button
                    onClick={() => setShowLabels(!showLabels)}
                    className="p-2 rounded hover:bg-gray-100"
                    title="Toggle Labels"
                >
                    {showLabels ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </button>

                <button
                    onClick={() => setShowLayerPanel(!showLayerPanel)}
                    className={`px-3 py-2 rounded flex items-center space-x-2 ${showLayerPanel ? 'bg-purple-100 text-purple-700' : 'hover:bg-gray-100'
                        }`}
                    title="Layers"
                >
                    <Layers className="w-5 h-5" />
                    <span className="text-sm font-medium">Layers</span>
                </button>

                <div className="border-l h-6 mx-2"></div>

                {activeLayer && activeLayer.vertices.length >= 3 && (
                    <>
                        <input
                            type="text"
                            placeholder="Plot label"
                            value={currentPolygonLabel}
                            onChange={(e) => setCurrentPolygonLabel(e.target.value)}
                            className="px-3 py-2 border rounded text-sm"
                        />
                        <button
                            onClick={closePolygon}
                            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium"
                        >
                            Close Polygon
                        </button>
                    </>
                )}

                {activeLayer && activeLayer.vertices.length > 0 && (
                    <button
                        onClick={clearCurrent}
                        className="p-2 rounded hover:bg-red-100 text-red-600"
                        title="Clear Current"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                )}

                <div className="flex-1"></div>

                {!pixelsPerFoot && (
                    <div className="text-sm text-orange-600 font-medium bg-orange-50 px-3 py-1 rounded">
                        ⚠ Please calibrate scale first
                    </div>
                )}
            </div>

            {/* Canvas */}
            <div className="flex-1 overflow-hidden relative bg-gray-200">
                <canvas
                    ref={canvasRef}
                    width={1200}
                    height={800}
                    onClick={handleCanvasClick}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onWheel={handleWheel}
                    className="absolute inset-0"
                    style={{
                        cursor: mode === 'zoom' ? (isDragging ? 'grabbing' : 'grab') :
                            mode === 'calibrate' ? 'crosshair' :
                                draggedVertexIndex !== null ? 'move' : 'crosshair'
                    }}
                />
                <img
                    ref={imageRef}
                    src={image}
                    alt="Map"
                    className="hidden"
                />

                {/* Layer Panel */}
                {showLayerPanel && (
                    <div className="absolute top-4 right-4 bg-white rounded-lg shadow-xl p-4 w-72 max-h-96 overflow-y-auto">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-bold text-gray-800 flex items-center space-x-2">
                                <Layers className="w-5 h-5" />
                                <span>Layers</span>
                            </h3>
                            <button
                                onClick={() => setShowLayerPanel(false)}
                                className="p-1 hover:bg-gray-100 rounded"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <button
                            onClick={addNewLayer}
                            className="w-full mb-3 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center justify-center space-x-2"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Add New Layer</span>
                        </button>

                        <div className="space-y-2">
                            {layers.map((layer) => (
                                <div
                                    key={layer.id}
                                    className={`p-3 rounded-lg border-2 transition-colors ${layer.id === activeLayerId
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center space-x-2 flex-1">
                                            <div
                                                className="w-4 h-4 rounded"
                                                style={{ backgroundColor: layer.color }}
                                            ></div>
                                            <input
                                                type="text"
                                                value={layer.name}
                                                onChange={(e) => {
                                                    setLayers(layers.map(l =>
                                                        l.id === layer.id ? { ...l, name: e.target.value } : l
                                                    ));
                                                }}
                                                className="flex-1 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                onClick={() => setActiveLayerId(layer.id)}
                                            />
                                        </div>
                                        <div className="flex items-center space-x-1">
                                            <button
                                                onClick={() => toggleLayerVisibility(layer.id)}
                                                className="p-1 hover:bg-gray-200 rounded"
                                                title={layer.visible ? 'Hide layer' : 'Show layer'}
                                            >
                                                {layer.visible ? (
                                                    <Eye className="w-4 h-4 text-gray-600" />
                                                ) : (
                                                    <EyeOff className="w-4 h-4 text-gray-400" />
                                                )}
                                            </button>
                                            {layers.length > 1 && (
                                                <button
                                                    onClick={() => deleteLayer(layer.id)}
                                                    className="p-1 hover:bg-red-100 rounded text-red-600"
                                                    title="Delete layer"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-xs text-gray-600">
                                        {layer.polygons.length} polygon{layer.polygons.length !== 1 ? 's' : ''}
                                        {layer.vertices.length > 0 && ` • ${layer.vertices.length} points`}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 space-y-2">
                    <div className="text-xs font-bold text-gray-700 mb-2">Controls:</div>
                    <div className="text-xs text-gray-600">
                        <span className="font-semibold text-blue-600">Points Mode:</span> Click to add points, drag vertices to move
                    </div>
                    <div className="text-xs text-gray-600">
                        <span className="font-semibold text-green-600">Zoom Mode:</span> Scroll to zoom, drag to pan
                    </div>
                    <div className="text-xs text-gray-600">
                        <span className="font-semibold text-orange-600">Calibrate:</span> Draw line, enter distance
                    </div>
                    <div className="text-xs text-gray-600">
                        <span className="font-semibold text-red-600">Split Area:</span> Click 2 vertices to divide polygon
                    </div>
                    {activeLayer && (
                        <div className="text-xs text-gray-600 mt-2 pt-2 border-t">
                            <span className="font-semibold">Active Layer:</span> {activeLayer.name}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LandAreaCalculator;