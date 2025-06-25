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
        const showAllSeries = document.getElementById('showAllSeries') && document.getElementById('showAllSeries').checked;
        const chartType = document.getElementById('chartType') ? document.getElementById('chartType').value : 'line';
        const smoothLines = document.getElementById('smoothLines') ? document.getElementById('smoothLines').checked : true;
        
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
                backgroundColor: color + '20',
                pointBackgroundColor: color,
                pointBorderColor: color,
                pointRadius: chartType === 'scatter' ? 4 : 2,
                pointHoverRadius: 6,
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
        
        // Create chart configuration
        const config = {
            type: chartType,
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
                            color: '#e0e0e0',
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: '#1a1a1a',
                        titleColor: '#f46800',
                        bodyColor: '#e0e0e0',
                        borderColor: '#333',
                        borderWidth: 1,
                        callbacks: {
                            title: function(context) {
                                const timeStr = allTimePoints[context[0].dataIndex];
                                return new Date(timeStr).toLocaleString();
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'category',
                        grid: {
                            color: '#333'
                        },
                        ticks: {
                            color: '#b0b0b0',
                            maxRotation: 45,
                            minRotation: 0
                        },
                        title: {
                            display: true,
                            text: 'Time',
                            color: '#b0b0b0'
                        }
                    },
                    y: {
                        grid: {
                            color: '#333'
                        },
                        ticks: {
                            color: '#b0b0b0'
                        },
                        title: {
                            display: true,
                            text: 'Value',
                            color: '#b0b0b0'
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
function updateChart() {
    if (GrafanaConfig.currentResults && GrafanaConfig.currentViewMode === 'chart') {
        const result = GrafanaConfig.currentResults.results.A;
        Charts.initializeChart(result.frames);
    }
}