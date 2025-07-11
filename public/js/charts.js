const Charts = {
    // Initialize chart
    initializeChart(frames) {
        const canvas = document.getElementById('timeSeriesChart');
        if (!canvas) return;
        
        // Destroy existing chart instance
        if (GrafanaConfig.chartInstance) {
            GrafanaConfig.chartInstance.destroy();
            GrafanaConfig.chartInstance = null;
        }
        
        const ctx = canvas.getContext('2d');
        
        // Get control values with proper defaults
        const showAllSeriesEl = document.getElementById('showAllSeries');
        const chartTypeEl = document.getElementById('chartType');
        const smoothLinesEl = document.getElementById('smoothLines');
        
        console.log('Control elements found:', {
            showAllSeries: !!showAllSeriesEl,
            chartType: !!chartTypeEl,
            smoothLines: !!smoothLinesEl
        });
        
        const showAllSeries = showAllSeriesEl ? showAllSeriesEl.checked : false;
        const chartType = chartTypeEl ? chartTypeEl.value : 'line';
        const smoothLines = smoothLinesEl ? smoothLinesEl.checked : true;
        
        console.log('Chart controls values:', { showAllSeries, chartType, smoothLines });
        
        const datasets = [];
        const framesToChart = showAllSeries ? frames : [frames[GrafanaConfig.selectedSeries] || frames[0]];
        
        // Collect all unique time points
        let allTimePoints = [];
        let timeLabels = [];
        
        framesToChart.forEach(function(frame, frameIndex) {
            if (!frame || !frame.data || !frame.data.values) return;
            
            // Find time and value columns
            const timeFieldIndex = frame.schema.fields.findIndex(function(field) {
                return field.type === 'time';
            });
            const valueFieldIndex = frame.schema.fields.findIndex(function(field) {
                return field.type === 'number' && field.name !== 'time';
            });
            
            if (timeFieldIndex === -1 || valueFieldIndex === -1) return;
            
            const timeData = frame.data.values[timeFieldIndex];
            const valueData = frame.data.values[valueFieldIndex];
            
            if (!timeData || !valueData) return;
            
            // Create data points
            const dataPoints = [];
            const frameTimePoints = [];
            
            for (let i = 0; i < Math.min(timeData.length, valueData.length); i++) {
                if (timeData[i] !== null && valueData[i] !== null) {
                    const timestamp = new Date(timeData[i]);
                    if (!isNaN(timestamp.getTime())) {
                        dataPoints.push(valueData[i]);
                        frameTimePoints.push(timestamp);
                    }
                }
            }
            
            // Sort data points by time
            const sortedData = dataPoints.map(function(value, index) {
                return { time: frameTimePoints[index], value: value };
            }).sort(function(a, b) {
                return a.time.getTime() - b.time.getTime();
            });
            
            const sortedValues = sortedData.map(function(item) { return item.value; });
            const sortedTimes = sortedData.map(function(item) { return item.time; });
            
            // Add to all time points
            sortedTimes.forEach(function(time) {
                const timeStr = time.toISOString();
                if (allTimePoints.indexOf(timeStr) === -1) {
                    allTimePoints.push(timeStr);
                }
            });
            
            const color = ChartColors[frameIndex % ChartColors.length];
            const seriesName = Utils.extractSeriesName(frame, frameIndex);
            
            datasets.push({
                label: seriesName,
                data: sortedValues,
                borderColor: color,
                backgroundColor: color + '33', // Better transparency
                pointBackgroundColor: color,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 1,
                pointRadius: chartType === 'scatter' ? 4 : 2,
                pointHoverRadius: 6,
                pointHoverBorderWidth: 2,
                tension: smoothLines ? 0.4 : 0,
                fill: false,
                borderWidth: 2,
                timeData: sortedTimes
            });
        });
        
        // Sort all time points and create labels
        allTimePoints.sort();
        timeLabels = allTimePoints.map(function(timeStr) {
            const date = new Date(timeStr);
            const now = new Date();
            const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
            
            if (diffHours < 24) {
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else if (diffHours < 24 * 7) {
                return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
                       date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else {
                return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
            }
        });
        
        // Align all datasets to the same time points
        datasets.forEach(function(dataset) {
            const paddedData = [];
            const datasetTimes = dataset.timeData.map(function(time) { return time.toISOString(); });
            
            allTimePoints.forEach(function(timePoint) {
                const index = datasetTimes.indexOf(timePoint);
                paddedData.push(index >= 0 ? dataset.data[index] : null);
            });
            
            dataset.data = paddedData;
            delete dataset.timeData; // Clean up temporary data
        });
        
        // Update datasets based on chart type and smooth lines setting
        datasets.forEach(function(dataset) {
            // Apply smooth lines setting
            dataset.tension = smoothLines ? 0.4 : 0;
            
            if (chartType === 'bar') {
                dataset.type = 'bar';
                dataset.borderWidth = 1;
                dataset.pointRadius = 0;
                dataset.fill = false;
            } else if (chartType === 'scatter') {
                dataset.type = 'scatter';
                dataset.showLine = false;
                dataset.pointRadius = 6;
                dataset.pointHoverRadius = 8;
                dataset.borderWidth = 0;
                dataset.fill = false;
            } else {
                // Line chart (default)
                dataset.type = 'line';
                dataset.showLine = true;
                dataset.pointRadius = 3;
                dataset.pointHoverRadius = 6;
                dataset.borderWidth = 2;
                dataset.fill = false;
            }
        });

        // Create chart configuration
        const config = {
            type: chartType === 'scatter' ? 'scatter' : (chartType === 'bar' ? 'bar' : 'line'),
            data: {
                labels: timeLabels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: showAllSeries || datasets.length > 1,
                        labels: {
                            color: '#cccccc',
                            usePointStyle: true,
                            padding: 15,
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: '#2d2d30',
                        titleColor: '#007acc',
                        bodyColor: '#cccccc',
                        borderColor: '#007acc',
                        borderWidth: 1,
                        cornerRadius: 4,
                        callbacks: {
                            title: function(context) {
                                const timeStr = allTimePoints[context[0].dataIndex];
                                return new Date(timeStr).toLocaleString();
                            },
                            label: function(context) {
                                return context.dataset.label + ': ' + (context.parsed.y !== null ? context.parsed.y.toFixed(2) : 'N/A');
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'category',
                        grid: {
                            color: '#3c3c3c',
                            borderColor: '#3c3c3c'
                        },
                        ticks: {
                            color: '#cccccc',
                            maxRotation: 45,
                            minRotation: 0,
                            font: {
                                size: 11
                            }
                        },
                        title: {
                            display: true,
                            text: 'Time',
                            color: '#cccccc',
                            font: {
                                size: 12,
                                weight: 'normal'
                            }
                        }
                    },
                    y: {
                        grid: {
                            color: '#3c3c3c',
                            borderColor: '#3c3c3c'
                        },
                        ticks: {
                            color: '#cccccc',
                            font: {
                                size: 11
                            }
                        },
                        title: {
                            display: true,
                            text: 'Value',
                            color: '#cccccc',
                            font: {
                                size: 12,
                                weight: 'normal'
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                spanGaps: true
            }
        };
        
        // Create the chart
        try {
            GrafanaConfig.chartInstance = new Chart(ctx, config);
            console.log('Chart created successfully with ' + datasets.length + ' datasets');
            
            
        } catch (error) {
            console.error('Chart creation error:', error);
            document.querySelector('.chart-wrapper').innerHTML = 
                '<div style="padding: 20px; text-align: center; color: #f87171;">' +
                'Chart Error: ' + error.message + '<br>' +
                'Unable to display chart visualization.' +
                '</div>';
        }
    }
};

// Global function for HTML onclick handlers
window.updateChart = function() {
    console.log('updateChart called');
    console.log('Current view mode:', GrafanaConfig.currentViewMode);
    console.log('Has current results:', !!GrafanaConfig.currentResults);
    
    // Check if chart controls exist at this point
    const showAllSeriesEl = document.getElementById('showAllSeries');
    const chartTypeEl = document.getElementById('chartType');
    const smoothLinesEl = document.getElementById('smoothLines');
    
    console.log('Controls available during updateChart:', {
        showAllSeries: !!showAllSeriesEl,
        chartType: !!chartTypeEl,
        smoothLines: !!smoothLinesEl
    });
    
    if (showAllSeriesEl) console.log('showAllSeries checked:', showAllSeriesEl.checked);
    if (chartTypeEl) console.log('chartType value:', chartTypeEl.value);
    if (smoothLinesEl) console.log('smoothLines checked:', smoothLinesEl.checked);
    
    if (GrafanaConfig.currentResults && GrafanaConfig.currentViewMode === 'chart') {
        const result = GrafanaConfig.currentResults.results.A;
        console.log('Updating ONLY the chart with', result.frames.length, 'frames');
        // Only reinitialize the chart, don't recreate the entire results area
        Charts.initializeChart(result.frames);
        
        // Re-attach event listeners after chart update
        setTimeout(() => {
            const showAllSeriesEl2 = document.getElementById('showAllSeries');
            const chartTypeEl2 = document.getElementById('chartType');
            const smoothLinesEl2 = document.getElementById('smoothLines');
            
            if (showAllSeriesEl2 && !showAllSeriesEl2.hasAttribute('data-listener-attached')) {
                showAllSeriesEl2.setAttribute('data-listener-attached', 'true');
                showAllSeriesEl2.addEventListener('change', function() {
                    console.log('Show All Series changed to:', showAllSeriesEl2.checked);
                    updateChart();
                });
            }
            if (chartTypeEl2 && !chartTypeEl2.hasAttribute('data-listener-attached')) {
                chartTypeEl2.setAttribute('data-listener-attached', 'true');
                chartTypeEl2.addEventListener('change', function() {
                    console.log('Chart Type changed to:', chartTypeEl2.value);
                    updateChart();
                });
            }
            if (smoothLinesEl2 && !smoothLinesEl2.hasAttribute('data-listener-attached')) {
                smoothLinesEl2.setAttribute('data-listener-attached', 'true');
                smoothLinesEl2.addEventListener('change', function() {
                    console.log('Smooth Lines changed to:', smoothLinesEl2.checked);
                    updateChart();
                });
            }
        }, 50);
    } else {
        console.log('Chart update conditions not met');
    }
};