// InfluxQL Linter Module
// Provides syntax checking and validation for InfluxQL queries

(function(window) {
    'use strict';

    // InfluxQL Keywords and syntax elements from the spec
    const KEYWORDS = new Set([
        'ALL', 'ALTER', 'ANALYZE', 'ANY', 'AS', 'ASC', 'BEGIN', 'BY', 'CREATE', 'CONTINUOUS',
        'DATABASE', 'DATABASES', 'DEFAULT', 'DELETE', 'DESC', 'DESTINATIONS', 'DIAGNOSTICS',
        'DROP', 'DURATION', 'END', 'EVERY', 'EXPLAIN', 'FIELD', 'FILL', 'FOR', 'FROM', 'GRANT', 'GRANTS',
        'GROUP', 'GROUPS', 'IN', 'INF', 'INSERT', 'INTO', 'KEY', 'KEYS', 'KILL', 'LIMIT', 'SHOW',
        'MEASUREMENT', 'MEASUREMENTS', 'NAME', 'OFFSET', 'ON', 'ORDER', 'PASSWORD', 'POLICY', 'POLICIES',
        'PRIVILEGES', 'QUERIES', 'QUERY', 'READ', 'REPLICATION', 'RESAMPLE', 'RETENTION', 'REVOKE',
        'SELECT', 'SERIES', 'SET', 'SHARD', 'SHARDS', 'SLIMIT', 'SOFFSET', 'STATS', 'SUBSCRIPTION',
        'SUBSCRIPTIONS', 'TAG', 'TO', 'USER', 'USERS', 'VALUES', 'WHERE', 'WITH', 'WRITE',
        'AND', 'OR', 'NOT', 'IS', 'LIKE', 'REGEX', 'TRUE', 'FALSE', 'NULL', 'NOW', 'TIME', 'TZ',
        'LINEAR', 'NONE', 'PREVIOUS'
    ]);

    const FUNCTIONS = new Set([
        'COUNT', 'DISTINCT', 'SUM', 'MEAN', 'MEDIAN', 'MODE', 'SPREAD', 'STDDEV', 'FIRST', 'LAST', 'MAX', 'MIN',
        'PERCENTILE', 'SAMPLE', 'TOP', 'BOTTOM', 'DERIVATIVE', 'DIFFERENCE', 'NON_NEGATIVE_DERIVATIVE',
        'INTEGRAL', 'ELAPSED', 'MOVING_AVERAGE', 'CUMULATIVE_SUM', 'HOLT_WINTERS'
    ]);

    // Aggregate functions that satisfy GROUP BY requirements
    const AGGREGATE_FUNCTIONS = new Set([
        'COUNT', 'DISTINCT', 'SUM', 'MEAN', 'MEDIAN', 'MODE', 'SPREAD', 'STDDEV', 
        'FIRST', 'LAST', 'MAX', 'MIN', 'PERCENTILE', 'SAMPLE', 'TOP', 'BOTTOM'
    ]);

    const TIME_UNITS = ['u', 'µ', 'ms', 's', 'm', 'h', 'd', 'w'];
    const FILL_OPTIONS = ['null', 'none', 'previous', 'linear'];

    // Token types
    const TokenType = {
        KEYWORD: 'keyword',
        FUNCTION: 'function',
        IDENTIFIER: 'identifier',
        NUMBER: 'number',
        STRING: 'string',
        OPERATOR: 'operator',
        LPAREN: 'lparen',
        RPAREN: 'rparen',
        COMMA: 'comma',
        DOT: 'dot',
        SEMICOLON: 'semicolon',
        DURATION: 'duration',
        REGEX: 'regex',
        COMMENT: 'comment',
        WHITESPACE: 'whitespace',
        INVALID: 'invalid',
        EOF: 'eof'
    };

    // Tokenizer
    class Tokenizer {
        constructor(input) {
            this.input = input;
            this.position = 0;
            this.line = 0;
            this.column = 0;
        }

        current() {
            return this.input[this.position] || '';
        }

        peek(offset = 1) {
            return this.input[this.position + offset] || '';
        }

        advance() {
            if (this.current() === '\n') {
                this.line++;
                this.column = 0;
            } else {
                this.column++;
            }
            this.position++;
        }

        isRegexContext() {
            // Look backwards for =~ or !~ operators
            let pos = this.position - 1;
            
            // Skip whitespace backwards
            while (pos >= 0 && /\s/.test(this.input[pos])) {
                pos--;
            }
            
            // Check for =~ or !~
            if (pos >= 1 && this.input.slice(pos - 1, pos + 1) === '=~') {
                return true;
            }
            if (pos >= 1 && this.input.slice(pos - 1, pos + 1) === '!~') {
                return true;
            }
            
            return false;
        }

        skipWhitespace() {
            const start = this.position;
            while (/\s/.test(this.current())) {
                this.advance();
            }
            return this.position > start;
        }

        readString(quote) {
            const start = this.position;
            const startLine = this.line;
            const startColumn = this.column;
            this.advance(); // Skip opening quote

            let escaped = false;
            while (this.position < this.input.length) {
                if (escaped) {
                    escaped = false;
                } else if (this.current() === '\\') {
                    escaped = true;
                } else if (this.current() === quote) {
                    this.advance(); // Skip closing quote
                    return {
                        type: TokenType.STRING,
                        value: this.input.slice(start, this.position),
                        start: start,
                        end: this.position,
                        line: startLine,
                        column: startColumn
                    };
                }
                this.advance();
            }

            // Unclosed string
            return {
                type: TokenType.INVALID,
                value: this.input.slice(start, this.position),
                start: start,
                end: this.position,
                line: startLine,
                column: startColumn,
                error: 'Unclosed string literal',
                quickFix: {
                    title: `Add closing ${quote} quote`,
                    action: 'insert',
                    position: 'after',
                    newText: quote
                }
            };
        }

        readRegex() {
            const start = this.position;
            const startLine = this.line;
            const startColumn = this.column;
            this.advance(); // Skip opening /

            let escaped = false;
            while (this.position < this.input.length) {
                if (escaped) {
                    escaped = false;
                } else if (this.current() === '\\') {
                    escaped = true;
                } else if (this.current() === '/') {
                    this.advance(); // Skip closing /
                    return {
                        type: TokenType.REGEX,
                        value: this.input.slice(start, this.position),
                        start: start,
                        end: this.position,
                        line: startLine,
                        column: startColumn
                    };
                } else if (this.current() === '\n') {
                    // Regex can't span lines, this is probably an invalid regex
                    return {
                        type: TokenType.INVALID,
                        value: this.input.slice(start, this.position),
                        start: start,
                        end: this.position,
                        line: startLine,
                        column: startColumn,
                        error: 'Unclosed regular expression (cannot span lines)'
                    };
                }
                // Note: Inside regex, # characters are literal, not comments
                this.advance();
            }

            // Unclosed regex
            return {
                type: TokenType.INVALID,
                value: this.input.slice(start, this.position),
                start: start,
                end: this.position,
                line: startLine,
                column: startColumn,
                error: 'Unclosed regular expression'
            };
        }

        readNumber() {
            const start = this.position;
            const startLine = this.line;
            const startColumn = this.column;

            // Optional sign
            if (this.current() === '+' || this.current() === '-') {
                this.advance();
            }

            // Integer part
            while (/\d/.test(this.current())) {
                this.advance();
            }

            // Decimal part
            if (this.current() === '.' && /\d/.test(this.peek())) {
                this.advance(); // Skip .
                while (/\d/.test(this.current())) {
                    this.advance();
                }
            }

            // Check for duration
            const numberEnd = this.position;
            let isDuration = false;
            let durationUnit = '';

            // Check for duration units
            for (const unit of TIME_UNITS) {
                if (this.input.substr(this.position, unit.length) === unit) {
                    this.position += unit.length;
                    this.column += unit.length;
                    isDuration = true;
                    durationUnit = unit;
                    break;
                }
            }

            return {
                type: isDuration ? TokenType.DURATION : TokenType.NUMBER,
                value: this.input.slice(start, this.position),
                start: start,
                end: this.position,
                line: startLine,
                column: startColumn
            };
        }

        readIdentifier() {
            const start = this.position;
            const startLine = this.line;
            const startColumn = this.column;

            // First character must be letter or underscore
            if (!/[a-zA-Z_]/.test(this.current())) {
                return null;
            }

            while (/[a-zA-Z0-9_]/.test(this.current())) {
                this.advance();
            }

            const value = this.input.slice(start, this.position);
            const upperValue = value.toUpperCase();

            let type = TokenType.IDENTIFIER;
            if (KEYWORDS.has(upperValue)) {
                type = TokenType.KEYWORD;
            } else if (FUNCTIONS.has(upperValue)) {
                type = TokenType.FUNCTION;
            }

            return {
                type: type,
                value: value,
                start: start,
                end: this.position,
                line: startLine,
                column: startColumn
            };
        }

        readComment() {
            const start = this.position;
            const startLine = this.line;
            const startColumn = this.column;

            if (this.current() === '-' && this.peek() === '-') {
                // Single line comment
                this.advance();
                this.advance();
                while (this.current() && this.current() !== '\n') {
                    this.advance();
                }
                return {
                    type: TokenType.COMMENT,
                    value: this.input.slice(start, this.position),
                    start: start,
                    end: this.position,
                    line: startLine,
                    column: startColumn
                };
            }

            if (this.current() === '/' && this.peek() === '*') {
                // Multi-line comment
                this.advance();
                this.advance();
                while (this.position < this.input.length - 1) {
                    if (this.current() === '*' && this.peek() === '/') {
                        this.advance();
                        this.advance();
                        return {
                            type: TokenType.COMMENT,
                            value: this.input.slice(start, this.position),
                            start: start,
                            end: this.position,
                            line: startLine,
                            column: startColumn
                        };
                    }
                    this.advance();
                }

                // Unclosed comment
                return {
                    type: TokenType.INVALID,
                    value: this.input.slice(start, this.position),
                    start: start,
                    end: this.position,
                    line: startLine,
                    column: startColumn,
                    error: 'Unclosed comment'
                };
            }

            return null;
        }

        nextToken() {
            this.skipWhitespace();

            if (this.position >= this.input.length) {
                return {
                    type: TokenType.EOF,
                    value: '',
                    start: this.position,
                    end: this.position,
                    line: this.line,
                    column: this.column
                };
            }

            const start = this.position;
            const startLine = this.line;
            const startColumn = this.column;

            // Comments
            const comment = this.readComment();
            if (comment) return comment;

            // Strings
            if (this.current() === "'" || this.current() === '"') {
                return this.readString(this.current());
            }

            // Regular expressions - only after regex operators (=~, !~)
            if (this.current() === '/' && this.peek() !== '*' && this.isRegexContext()) {
                return this.readRegex();
            }

            // Numbers
            if (/\d/.test(this.current()) || 
                ((this.current() === '+' || this.current() === '-') && /\d/.test(this.peek())) ||
                (this.current() === '.' && /\d/.test(this.peek()))) {
                return this.readNumber();
            }

            // Identifiers and keywords
            const identifier = this.readIdentifier();
            if (identifier) return identifier;

            // Handle template variables ($timeFilter, $interval, etc.)
            if (this.current() === '$') {
                const start = this.position;
                this.advance(); // consume $
                while (/[a-zA-Z0-9_]/.test(this.current())) {
                    this.advance();
                }
                return {
                    type: TokenType.IDENTIFIER, // Treat template variables as identifiers
                    value: this.input.slice(start, this.position),
                    start: start,
                    end: this.position,
                    line: startLine,
                    column: startColumn
                };
            }

            // Operators and punctuation
            const char = this.current();
            const twoChar = char + this.peek();
            
            let type = TokenType.INVALID;
            let value = char;
            let length = 1;

            // Two-character operators
            if (['!=', '<>', '<=', '>=', '=~', '!~', '::'].includes(twoChar)) {
                type = TokenType.OPERATOR;
                value = twoChar;
                length = 2;
            }
            // Single-character operators and punctuation
            else if ('+-*/%&|^=<>'.includes(char)) {
                type = TokenType.OPERATOR;
            } else if (char === '(') {
                type = TokenType.LPAREN;
            } else if (char === ')') {
                type = TokenType.RPAREN;
            } else if (char === ',') {
                type = TokenType.COMMA;
            } else if (char === '.') {
                type = TokenType.DOT;
            } else if (char === ';') {
                type = TokenType.SEMICOLON;
            }

            this.position += length;
            this.column += length;

            return {
                type: type,
                value: value,
                start: start,
                end: this.position,
                line: startLine,
                column: startColumn,
                error: type === TokenType.INVALID ? `Unexpected character: ${value}` : undefined
            };
        }

        tokenize() {
            const tokens = [];
            let token;
            while ((token = this.nextToken()).type !== TokenType.EOF) {
                if (token.type !== TokenType.WHITESPACE && token.type !== TokenType.COMMENT) {
                    tokens.push(token);
                }
            }
            tokens.push(token); // Add EOF token
            return tokens;
        }
    }

    // Simple InfluxQL syntax validator
    class InfluxQLValidator {
        constructor(text) {
            this.text = text;
            this.errors = [];
            this.tokenizer = new Tokenizer(text);
            this.tokens = [];
            this.current = 0;
            // Track query structure for validation
            this.selectFields = [];
            this.hasGroupBy = false;
            this.hasGroupByTime = false;
            this.isInAggregateFunction = false;
        }

        validate() {
            try {
                this.tokens = this.tokenizer.tokenize();
                
                // Check for tokenization errors
                for (const token of this.tokens) {
                    if (token.type === TokenType.INVALID) {
                        this.addError(token.error || 'Invalid token', token, token.quickFix);
                    }
                }

                // Basic syntax validation
                this.validateStatements();

            } catch (e) {
                this.addError('Unexpected error: ' + e.message, {
                    line: 0,
                    column: 0,
                    start: 0,
                    end: this.text.length
                });
            }

            return this.errors;
        }

        currentToken() {
            return this.tokens[this.current] || this.tokens[this.tokens.length - 1];
        }

        peekToken(offset = 1) {
            return this.tokens[this.current + offset] || this.tokens[this.tokens.length - 1];
        }

        consume(type, value = null) {
            const token = this.currentToken();
            if (token.type === type && (value === null || token.value.toUpperCase() === value.toUpperCase())) {
                this.current++;
                return token;
            }
            return null;
        }

        expect(type, value = null, message = null) {
            const token = this.consume(type, value);
            if (!token) {
                const current = this.currentToken();
                const errorMsg = message || `Expected ${type}${value ? ' ' + value : ''}, got ${current.type} '${current.value}'`;
                this.addError(errorMsg, current);
                return null;
            }
            return token;
        }

        addError(message, token, quickFix = null) {
            // Convert token position to CodeMirror format
            const from = { line: token.line, ch: token.column };
            const to = { line: token.line, ch: token.column + (token.end - token.start) };
            
            const error = {
                message: message,
                severity: 'error',
                from: from,
                to: to
            };
            
            if (quickFix) {
                error.quickFix = quickFix;
            }
            
            this.errors.push(error);
        }

        expectIdentifierOrString(message) {
            if (this.consume(TokenType.IDENTIFIER) || this.consume(TokenType.STRING)) {
                return true;
            }
            this.addError(message || 'Expected identifier or quoted string', this.currentToken());
            return false;
        }

        validateStatements() {
            while (this.currentToken().type !== TokenType.EOF) {
                this.validateStatement();
                
                // Skip semicolons between statements
                while (this.consume(TokenType.SEMICOLON)) {
                    // Continue
                }
            }
        }

        validateStatement() {
            const token = this.currentToken();
            const startPosition = this.current;
            
            if (token.type === TokenType.KEYWORD) {
                const keyword = token.value.toUpperCase();
                
                switch (keyword) {
                    case 'SELECT':
                        this.validateSelectStatement();
                        break;
                    case 'SHOW':
                        this.validateShowStatement();
                        break;
                    case 'CREATE':
                        this.validateCreateStatement();
                        break;
                    case 'DROP':
                        this.validateDropStatement();
                        break;
                    case 'ALTER':
                        this.validateAlterStatement();
                        break;
                    case 'DELETE':
                        this.validateDeleteStatement();
                        break;
                    case 'INSERT':
                        this.validateInsertStatement();
                        break;
                    case 'GRANT':
                    case 'REVOKE':
                        this.validateGrantRevokeStatement();
                        break;
                    default:
                        this.addError(`Unexpected keyword '${keyword}' at start of statement`, token);
                        this.current++;
                }
            } else if (token.type !== TokenType.EOF) {
                this.addError('Expected statement keyword', token);
                this.current++;
            }
            
            // Error recovery: if we haven't moved forward, advance to avoid infinite loop
            if (this.current === startPosition && this.currentToken().type !== TokenType.EOF) {
                this.current++;
            }
        }

        validateSelectStatement() {
            this.expect(TokenType.KEYWORD, 'SELECT');
            
            // Reset state for this SELECT statement
            this.selectFields = [];
            this.hasGroupBy = false;
            
            // Validate field list
            if (!this.validateFieldList()) {
                return;
            }
            
            // FROM clause
            if (this.consume(TokenType.KEYWORD, 'FROM')) {
                if (!this.validateMeasurementList()) {
                    return;
                }
            } else {
                const quickFix = {
                    title: 'Add FROM clause',
                    action: 'insert',
                    position: 'after',
                    newText: ' FROM "measurement_name"'
                };
                this.addError('SELECT statement requires FROM clause', this.currentToken(), quickFix);
                return;
            }
            
            // Optional clauses
            this.validateOptionalClauses();
            
            // After parsing the full SELECT statement, validate field/tag rules
            this.validateFieldTagRules();
        }

        validateFieldList() {
            let hasField = false;
            const fieldListStart = this.current;
            
            do {
                const fieldStart = this.current;
                let fieldInfo = { hasAggregateFunction: false, hasField: false, hasTag: false, token: null };
                
                if (this.currentToken().type === TokenType.OPERATOR && this.currentToken().value === '*') {
                    this.current++;
                    hasField = true;
                    fieldInfo.hasField = true;
                    this.selectFields.push(fieldInfo);
                } else if (this.validateFieldExpression(fieldInfo)) {
                    hasField = true;
                    // Only track field info if it's not a complex expression
                    if (!fieldInfo.isComplexExpression) {
                        this.selectFields.push(fieldInfo);
                    }
                    // Optional alias
                    if (this.consume(TokenType.KEYWORD, 'AS')) {
                        // Alias can be either an identifier or a quoted string
                        if (!this.consume(TokenType.IDENTIFIER) && !this.consume(TokenType.STRING)) {
                            this.addError('Expected alias (identifier or quoted string) after AS', this.currentToken());
                        }
                    }
                } else {
                    if (!hasField) {
                        this.addError('Expected field expression', this.currentToken());
                    }
                    return hasField;
                }
            } while (this.consume(TokenType.COMMA));
            
            return hasField;
        }
        
        validateFieldExpression(fieldInfo) {
            return this.validateExpression(fieldInfo);
        }

        validateMeasurementList() {
            let hasMeasurement = false;
            
            do {
                if (this.validateMeasurement()) {
                    hasMeasurement = true;
                } else {
                    if (!hasMeasurement) {
                        this.addError('Expected measurement name', this.currentToken());
                    }
                    return hasMeasurement;
                }
            } while (this.consume(TokenType.COMMA));
            
            return hasMeasurement;
        }

        validateMeasurement() {
            // Check for subquery (nested SELECT in parentheses)
            if (this.currentToken().type === TokenType.LPAREN) {
                const start = this.current;
                this.current++; // consume opening paren
                
                // Check if this is a SELECT subquery
                if (this.currentToken().type === TokenType.KEYWORD && 
                    this.currentToken().value.toUpperCase() === 'SELECT') {
                    // Parse the nested SELECT statement
                    this.validateSelectStatement();
                    
                    // Expect closing paren
                    if (!this.expect(TokenType.RPAREN)) {
                        return false;
                    }
                    return true;
                } else {
                    // Not a subquery, restore position
                    this.current = start;
                }
            }
            
            // Simple measurement: identifier or regex
            if (this.consume(TokenType.IDENTIFIER) || this.consume(TokenType.STRING) || this.consume(TokenType.REGEX)) {
                // Optional database.retention_policy prefix
                while (this.consume(TokenType.DOT)) {
                    if (!this.consume(TokenType.IDENTIFIER) && !this.consume(TokenType.STRING)) {
                        this.addError('Expected identifier after dot', this.currentToken());
                        return false;
                    }
                }
                return true;
            }
            return false;
        }

        validateExpression(fieldInfo) {
            // Simple expression validation - just check for basic structure
            const start = this.current;
            
            // First, validate the primary expression (term)
            if (!this.validateTerm(fieldInfo)) {
                return false;
            }
            
            // Handle binary operators (arithmetic, comparison, etc.)
            while (this.currentToken().type === TokenType.OPERATOR) {
                const op = this.currentToken().value;
                // Check if it's a binary operator that continues the expression
                if (['+', '-', '*', '/', '%', '=', '!=', '<>', '<', '<=', '>', '>='].includes(op)) {
                    this.current++; // consume operator
                    if (fieldInfo) {
                        fieldInfo.isComplexExpression = true;
                    }
                    // Expect another term after the operator
                    if (!this.validateTerm(fieldInfo)) {
                        this.addError('Expected expression after operator ' + op, this.currentToken());
                        return false;
                    }
                } else {
                    // Not a binary operator we handle in expressions
                    break;
                }
            }
            
            return true;
        }
        
        validateTerm(fieldInfo) {
            // Handle parenthesized expressions first
            if (this.consume(TokenType.LPAREN)) {
                if (fieldInfo) {
                    fieldInfo.isComplexExpression = true;
                }
                if (!this.validateExpression(fieldInfo)) {
                    return false;
                }
                return this.expect(TokenType.RPAREN);
            }
            
            // Handle functions
            if (this.currentToken().type === TokenType.FUNCTION) {
                const funcName = this.currentToken().value.toUpperCase();
                const isAggregate = AGGREGATE_FUNCTIONS.has(funcName);
                if (fieldInfo && isAggregate) {
                    fieldInfo.hasAggregateFunction = true;
                }
                
                this.current++;
                if (!this.expect(TokenType.LPAREN)) {
                    return false;
                }
                
                // Mark that we're inside an aggregate function for nested field validation
                const wasInAggregate = this.isInAggregateFunction;
                if (isAggregate) {
                    this.isInAggregateFunction = true;
                }
                
                // Function arguments
                if (this.currentToken().type !== TokenType.RPAREN) {
                    do {
                        if (!this.validateExpression(fieldInfo)) {
                            return false;
                        }
                    } while (this.consume(TokenType.COMMA));
                }
                
                // Restore aggregate function context
                this.isInAggregateFunction = wasInAggregate;
                
                if (!this.expect(TokenType.RPAREN)) {
                    return false;
                }
                return true;
            }
            
            // Handle identifiers (field names) with optional ::tag or ::field suffix
            if (this.currentToken().type === TokenType.IDENTIFIER || this.currentToken().type === TokenType.STRING) {
                const identToken = this.currentToken();
                this.current++;
                
                // Check for optional ::tag or ::field casting
                let isTag = false;
                let isField = false;
                if (this.currentToken().type === TokenType.OPERATOR && this.currentToken().value === '::') {
                    this.current++; // consume ::
                    // Expect 'tag' or 'field' after :: (can be KEYWORD or IDENTIFIER)
                    const castToken = this.currentToken();
                    if ((castToken.type === TokenType.IDENTIFIER || castToken.type === TokenType.KEYWORD)) {
                        if (castToken.value.toLowerCase() === 'tag') {
                            isTag = true;
                            this.current++;
                        } else if (castToken.value.toLowerCase() === 'field') {
                            isField = true;
                            this.current++;
                        } else {
                            this.addError("Expected 'tag' or 'field' after ::", castToken);
                            return false;
                        }
                    }
                }
                
                // Track field/tag usage for validation
                if (fieldInfo && !fieldInfo.isComplexExpression) {
                    if (!identToken.value.startsWith('$')) { // Don't count variables as fields
                        if (isTag) {
                            fieldInfo.hasTag = true;
                        } else if (isField || !isTag) {
                            // If explicitly marked as field or not marked at all, treat as field
                            fieldInfo.hasField = true;
                            fieldInfo.token = identToken;
                            
                            // If we have a GROUP BY and this field is not in an aggregate function, record it
                            if (!this.isInAggregateFunction && !fieldInfo.hasAggregateFunction) {
                                fieldInfo.nonAggregatedField = identToken;
                            }
                        }
                    }
                }
                
                return true;
            }
            
            // Handle numbers and regex patterns
            if (this.consume(TokenType.NUMBER) || this.consume(TokenType.DURATION) || this.consume(TokenType.REGEX)) {
                return true;
            }
            
            return false;
        }

        validateOptionalClauses() {
            // WHERE clause
            if (this.consume(TokenType.KEYWORD, 'WHERE')) {
                if (!this.validateWhereExpression()) {
                    return;
                }
            }
            
            // GROUP BY clause
            if (this.consume(TokenType.KEYWORD, 'GROUP')) {
                if (!this.expect(TokenType.KEYWORD, 'BY')) {
                    return;
                }
                this.hasGroupBy = true;
                this.validateGroupByClause();
            }
            
            // ORDER BY clause
            if (this.consume(TokenType.KEYWORD, 'ORDER')) {
                if (!this.expect(TokenType.KEYWORD, 'BY')) {
                    return;
                }
                this.validateOrderByClause();
            }
            
            // LIMIT clause
            if (this.consume(TokenType.KEYWORD, 'LIMIT')) {
                if (!this.expect(TokenType.NUMBER, null, 'Expected number after LIMIT')) {
                    return;
                }
            }
            
            // OFFSET clause
            if (this.consume(TokenType.KEYWORD, 'OFFSET')) {
                if (!this.expect(TokenType.NUMBER, null, 'Expected number after OFFSET')) {
                    return;
                }
            }
            
            // SLIMIT clause
            if (this.consume(TokenType.KEYWORD, 'SLIMIT')) {
                if (!this.expect(TokenType.NUMBER, null, 'Expected number after SLIMIT')) {
                    return;
                }
            }
            
            // SOFFSET clause
            if (this.consume(TokenType.KEYWORD, 'SOFFSET')) {
                if (!this.expect(TokenType.NUMBER, null, 'Expected number after SOFFSET')) {
                    return;
                }
            }
        }

        validateWhereExpression() {
            // Simple WHERE validation - just check basic structure
            return this.validateCondition();
        }

        validateCondition() {
            // Handle parenthesized conditions first
            if (this.consume(TokenType.LPAREN)) {
                if (!this.validateCondition()) {
                    return false;
                }
                if (!this.expect(TokenType.RPAREN)) {
                    return false;
                }
                
                // Handle AND/OR after parentheses
                while (this.consume(TokenType.KEYWORD, 'AND') || this.consume(TokenType.KEYWORD, 'OR')) {
                    if (!this.validateCondition()) {
                        return false;
                    }
                }
                return true;
            }
            
            // Left side
            if (!this.validateExpression()) {
                return false;
            }
            
            // Operator
            if (this.currentToken().type === TokenType.OPERATOR) {
                this.current++;
                
                // Right side
                if (!this.validateExpression()) {
                    return false;
                }
            }
            
            // Handle AND/OR
            while (this.consume(TokenType.KEYWORD, 'AND') || this.consume(TokenType.KEYWORD, 'OR')) {
                if (!this.validateCondition()) {
                    return false;
                }
            }
            
            return true;
        }

        validateGroupByClause() {
            let hasGrouping = false;
            this.hasGroupByTime = false; // Track if GROUP BY includes time()
            
            do {
                // Check for time() function
                if (this.currentToken().type === TokenType.KEYWORD && 
                    this.currentToken().value.toUpperCase() === 'TIME') {
                    this.current++;
                    if (this.expect(TokenType.LPAREN)) {
                        // Accept either a duration (1m, 5m, etc.) or a variable ($__interval, $myInterval, etc.)
                        const token = this.currentToken();
                        if (token.type === TokenType.DURATION || 
                            (token.type === TokenType.IDENTIFIER && token.value.startsWith('$'))) {
                            this.current++;
                        } else {
                            this.addError('Expected duration or variable in time() function', token);
                            return;
                        }
                        if (!this.expect(TokenType.RPAREN)) {
                            return;
                        }
                        hasGrouping = true;
                        this.hasGroupByTime = true; // Mark that we have GROUP BY time()
                    }
                } else if (this.validateExpression()) {
                    hasGrouping = true;
                } else {
                    if (!hasGrouping) {
                        this.addError('Expected grouping expression', this.currentToken());
                    }
                    return;
                }
            } while (this.consume(TokenType.COMMA));
            
            // Check for FILL clause
            if (this.consume(TokenType.KEYWORD, 'FILL')) {
                if (!this.expect(TokenType.LPAREN)) {
                    return;
                }
                
                const fillToken = this.currentToken();
                if (fillToken.type === TokenType.KEYWORD && FILL_OPTIONS.includes(fillToken.value.toLowerCase())) {
                    this.current++;
                } else if (fillToken.type === TokenType.NUMBER) {
                    this.current++;
                } else {
                    this.addError('Invalid FILL option. Expected: null, none, previous, linear, or a number', fillToken);
                }
                
                if (!this.expect(TokenType.RPAREN)) {
                    return;
                }
            }
        }

        validateOrderByClause() {
            do {
                // Special handling for 'time' keyword in ORDER BY
                if (this.currentToken().type === TokenType.KEYWORD && 
                    this.currentToken().value.toUpperCase() === 'TIME') {
                    // In ORDER BY, 'time' is a valid column reference, not the time() function
                    this.current++;
                } else if (!this.validateExpression()) {
                    this.addError('Expected expression in ORDER BY', this.currentToken());
                    return;
                }
                
                // Optional ASC/DESC
                this.consume(TokenType.KEYWORD, 'ASC') || this.consume(TokenType.KEYWORD, 'DESC');
                
            } while (this.consume(TokenType.COMMA));
        }

        validateShowStatement() {
            this.expect(TokenType.KEYWORD, 'SHOW');
            
            const nextToken = this.currentToken();
            if (nextToken.type !== TokenType.KEYWORD) {
                this.addError('Expected keyword after SHOW', nextToken);
                return;
            }
            
            const showType = nextToken.value.toUpperCase();
            this.current++;
            
            switch (showType) {
                case 'DATABASES':
                case 'MEASUREMENTS':
                case 'QUERIES':
                case 'SHARDS':
                case 'SUBSCRIPTIONS':
                case 'USERS':
                    // These don't require additional keywords
                    break;
                case 'FIELD':
                    this.expect(TokenType.KEYWORD, 'KEYS');
                    break;
                case 'TAG':
                    const tagNext = this.currentToken();
                    if (tagNext.type === TokenType.KEYWORD) {
                        if (tagNext.value.toUpperCase() === 'KEYS') {
                            this.current++;
                        } else if (tagNext.value.toUpperCase() === 'VALUES') {
                            this.current++;
                            // WITH KEY clause is required for TAG VALUES
                            if (!this.consume(TokenType.KEYWORD, 'WITH')) {
                                this.addError('SHOW TAG VALUES requires WITH KEY clause', this.currentToken());
                            } else {
                                this.expect(TokenType.KEYWORD, 'KEY');
                            }
                        }
                    }
                    break;
                case 'RETENTION':
                    this.expect(TokenType.KEYWORD, 'POLICIES');
                    break;
                case 'CONTINUOUS':
                    this.expect(TokenType.KEYWORD, 'QUERIES');
                    break;
                case 'SHARD':
                    this.expect(TokenType.KEYWORD, 'GROUPS');
                    break;
                default:
                    this.addError(`Unknown SHOW statement type: ${showType}`, nextToken);
            }
        }

        validateCreateStatement() {
            this.expect(TokenType.KEYWORD, 'CREATE');
            
            const nextToken = this.currentToken();
            if (nextToken.type !== TokenType.KEYWORD) {
                this.addError('Expected keyword after CREATE', nextToken);
                return;
            }
            
            const createType = nextToken.value.toUpperCase();
            this.current++;
            
            switch (createType) {
                case 'DATABASE':
                case 'USER':
                case 'SUBSCRIPTION':
                    // These can be identifiers or quoted strings
                    this.expectIdentifierOrString(`Expected ${createType.toLowerCase()} name`);
                    break;
                case 'RETENTION':
                    this.expect(TokenType.KEYWORD, 'POLICY');
                    this.expectIdentifierOrString('Expected retention policy name');
                    break;
                case 'CONTINUOUS':
                    this.expect(TokenType.KEYWORD, 'QUERY');
                    this.expectIdentifierOrString('Expected continuous query name');
                    break;
                default:
                    this.addError(`Unknown CREATE statement type: ${createType}`, nextToken);
            }
        }

        validateDropStatement() {
            this.expect(TokenType.KEYWORD, 'DROP');
            
            const nextToken = this.currentToken();
            if (nextToken.type !== TokenType.KEYWORD) {
                this.addError('Expected keyword after DROP', nextToken);
                return;
            }
            
            const dropType = nextToken.value.toUpperCase();
            this.current++;
            
            switch (dropType) {
                case 'DATABASE':
                case 'MEASUREMENT':
                case 'USER':
                case 'SHARD':
                case 'SERIES':
                case 'SUBSCRIPTION':
                    // These can be identifiers or quoted strings
                    this.expectIdentifierOrString(`Expected ${dropType.toLowerCase()} name`);
                    break;
                case 'RETENTION':
                    this.expect(TokenType.KEYWORD, 'POLICY');
                    this.expectIdentifierOrString('Expected retention policy name');
                    break;
                case 'CONTINUOUS':
                    this.expect(TokenType.KEYWORD, 'QUERY');
                    this.expectIdentifierOrString('Expected continuous query name');
                    break;
                default:
                    this.addError(`Unknown DROP statement type: ${dropType}`, nextToken);
            }
        }

        validateAlterStatement() {
            this.expect(TokenType.KEYWORD, 'ALTER');
            
            const nextToken = this.currentToken();
            if (nextToken.type === TokenType.KEYWORD && nextToken.value.toUpperCase() === 'RETENTION') {
                this.current++;
                this.expect(TokenType.KEYWORD, 'POLICY');
                this.expectIdentifierOrString('Expected retention policy name');
            } else {
                this.addError('ALTER only supports RETENTION POLICY', nextToken);
            }
        }

        validateDeleteStatement() {
            this.expect(TokenType.KEYWORD, 'DELETE');
            
            // Optional FROM clause
            if (this.consume(TokenType.KEYWORD, 'FROM')) {
                this.validateMeasurement();
            }
            
            // Optional WHERE clause
            if (this.consume(TokenType.KEYWORD, 'WHERE')) {
                this.validateWhereExpression();
            }
        }

        validateInsertStatement() {
            this.expect(TokenType.KEYWORD, 'INSERT');
            this.expect(TokenType.KEYWORD, 'INTO');
            
            // Measurement name
            if (!this.validateMeasurement()) {
                this.addError('Expected measurement name after INSERT INTO', this.currentToken());
            }
        }

        validateGrantRevokeStatement() {
            const isGrant = this.currentToken().value.toUpperCase() === 'GRANT';
            this.current++;
            
            // Privilege type
            const privToken = this.currentToken();
            if (privToken.type === TokenType.KEYWORD) {
                const priv = privToken.value.toUpperCase();
                if (['ALL', 'READ', 'WRITE'].includes(priv)) {
                    this.current++;
                    if (priv === 'ALL' && this.consume(TokenType.KEYWORD, 'PRIVILEGES')) {
                        // Optional PRIVILEGES after ALL
                    }
                } else {
                    this.addError('Invalid privilege type. Expected: ALL, READ, or WRITE', privToken);
                }
            } else {
                this.addError('Expected privilege type', privToken);
            }
            
            // TO/FROM user
            if (isGrant) {
                this.expect(TokenType.KEYWORD, 'TO');
            } else {
                this.expect(TokenType.KEYWORD, 'FROM');
            }
            
            this.expectIdentifierOrString('Expected user name');
        }
        
        validateFieldTagRules() {
            // Rule 1: If GROUP BY time() is present, all field references must be in aggregate functions
            // Note: GROUP BY with only tags does not require aggregate functions
            if (this.hasGroupByTime) {
                for (const fieldInfo of this.selectFields) {
                    if (fieldInfo.nonAggregatedField) {
                        const fieldName = fieldInfo.nonAggregatedField.value;
                        const quickFix = {
                            title: `Wrap '${fieldName}' with MEAN() function`,
                            action: 'replace',
                            newText: `MEAN(${fieldName})`
                        };
                        
                        this.addError(
                            `Field '${fieldName}' must be used with an aggregate function when GROUP BY time() is present`,
                            fieldInfo.nonAggregatedField,
                            quickFix
                        );
                    }
                }
            }
            
            // Rule 2: If only tags are selected (no fields), the query needs at least one field
            const hasFieldSelection = this.selectFields.some(f => f.hasField || f.hasAggregateFunction);
            const hasTagSelection = this.selectFields.some(f => f.hasTag);
            
            if (hasTagSelection && !hasFieldSelection && this.selectFields.length > 0) {
                // Find the first tag token for error positioning
                const tagField = this.selectFields.find(f => f.hasTag);
                const errorToken = tagField && tagField.token ? tagField.token : this.currentToken();
                this.addError(
                    'Query must select at least one field value in addition to tags',
                    errorToken
                );
            }
        }
    }

    // CodeMirror linting function
    function influxqlLint(text, options) {
        const validator = new InfluxQLValidator(text);
        const errors = validator.validate();
        
        // Convert to CodeMirror lint format
        const lintResults = errors.map(error => {
            const result = {
                from: CodeMirror.Pos(error.from.line, error.from.ch),
                to: CodeMirror.Pos(error.to.line, error.to.ch),
                message: error.message,
                severity: error.severity || 'error'
            };
            
            if (error.quickFix) {
                result.quickFix = error.quickFix;
            }
            
            return result;
        });
        
        return lintResults;
    }

    // Register the linter with CodeMirror
    if (typeof CodeMirror !== 'undefined') {
        CodeMirror.registerHelper('lint', 'influxql', influxqlLint);
    } else {
        console.error('CodeMirror not available when trying to register InfluxQL linter');
    }

    // Export for use in other modules
    window.InfluxQLLinter = {
        lint: influxqlLint,
        Tokenizer: Tokenizer,
        Validator: InfluxQLValidator
    };

})(window);