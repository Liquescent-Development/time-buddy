const GrafanaConfig = {
    // Connection state
    url: '',
    username: '',
    password: '',
    authHeader: '',
    currentConnectionId: null,
    
    // Application state
    currentQueryType: 'influxql',
    datasources: [],
    currentResults: null,
    currentPage: 1,
    pageSize: 100,
    totalRows: 0,
    selectedSeries: 0,
    currentViewMode: 'table',
    chartInstance: null,
    queryEditor: null,
    currentEditingConnectionId: null
};

// Query type keywords for autocomplete
const QueryKeywords = {
    promql: [
        'up', 'rate', 'increase', 'sum', 'avg', 'count', 'min', 'max',
        'histogram_quantile', 'topk', 'bottomk', 'sort', 'sort_desc',
        'absent', 'ceil', 'floor', 'round', 'sqrt', 'exp', 'ln', 'log2', 'log10',
        'abs', 'delta', 'deriv', 'predict_linear', 'irate', 'resets',
        'changes', 'label_replace', 'label_join', 'time', 'timestamp',
        'minute', 'hour', 'day_of_month', 'day_of_week', 'days_in_month',
        'month', 'year', 'vector', 'scalar', 'bool', 'by', 'without',
        'group_left', 'group_right', 'offset', 'ignoring', 'on', 'and', 'or', 'unless'
    ],
    influxql: [
        'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'LIMIT', 'OFFSET',
        'SHOW', 'CREATE', 'DROP', 'ALTER', 'INSERT', 'DELETE', 'UPDATE',
        'MEASUREMENTS', 'DATABASES', 'SERIES', 'TAG', 'FIELD', 'TIME',
        'MEAN', 'MEDIAN', 'MODE', 'SPREAD', 'STDDEV', 'SUM', 'COUNT',
        'DISTINCT', 'INTEGRAL', 'DERIVATIVE', 'DIFFERENCE', 'NON_NEGATIVE_DERIVATIVE',
        'ELAPSED', 'MOVING_AVERAGE', 'CUMULATIVE_SUM', 'HOLT_WINTERS',
        'PERCENTILE', 'SAMPLE', 'TOP', 'BOTTOM', 'FIRST', 'LAST', 'MAX', 'MIN',
        'NOW', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'REGEX', 'IS', 'NULL'
    ]
};

// Chart color palette - VS Code theme compatible
const ChartColors = [
    '#007acc', // VS Code blue (primary)
    '#4fc3f7', // Light blue
    '#66bb6a', // Green
    '#ffb74d', // Orange
    '#ba68c8', // Purple
    '#f06292', // Pink
    '#64b5f6', // Medium blue
    '#81c784', // Light green
    '#ffab40', // Amber
    '#9575cd', // Deep purple
    '#4dd0e1', // Cyan
    '#aed581'  // Light lime
];