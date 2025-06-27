// models/repositories/base/QueryBuilder.js
class QueryBuilder {
    constructor(supabase, tableName) {
        this.supabase = supabase;
        this.tableName = tableName;
        this.query = supabase.from(tableName);
        this.selectFields = '*';
        this.filters = [];
        this.orderBy = [];
        this.limitValue = null;
        this.offsetValue = null;
        this.rangeStart = null;
        this.rangeEnd = null;
    }

    // SELECT operations
    select(fields = '*') {
        this.selectFields = fields;
        return this;
    }

    // WHERE operations
    where(field, operator, value) {
        this.filters.push({ field, operator, value, type: 'where' });
        return this;
    }

    whereEquals(field, value) {
        return this.where(field, 'eq', value);
    }

    whereNotEquals(field, value) {
        return this.where(field, 'neq', value);
    }

    whereIn(field, values) {
        this.filters.push({ field, operator: 'in', value: values, type: 'where' });
        return this;
    }

    whereNotIn(field, values) {
        this.filters.push({ field, operator: 'not.in', value: values, type: 'where' });
        return this;
    }

    whereNull(field) {
        this.filters.push({ field, operator: 'is', value: null, type: 'where' });
        return this;
    }

    whereNotNull(field) {
        this.filters.push({ field, operator: 'not.is', value: null, type: 'where' });
        return this;
    }

    whereGreaterThan(field, value) {
        return this.where(field, 'gt', value);
    }

    whereGreaterThanOrEqual(field, value) {
        return this.where(field, 'gte', value);
    }

    whereLessThan(field, value) {
        return this.where(field, 'lt', value);
    }

    whereLessThanOrEqual(field, value) {
        return this.where(field, 'lte', value);
    }

    whereLike(field, pattern) {
        return this.where(field, 'like', pattern);
    }

    whereILike(field, pattern) {
        return this.where(field, 'ilike', pattern);
    }

    // OR operations
    whereOr(conditions) {
        this.filters.push({ conditions, type: 'or' });
        return this;
    }

    // Date range operations
    whereDateBetween(field, startDate, endDate) {
        this.filters.push({ 
            field, 
            operator: 'gte', 
            value: startDate.toISOString(), 
            type: 'where' 
        });
        this.filters.push({ 
            field, 
            operator: 'lte', 
            value: endDate.toISOString(), 
            type: 'where' 
        });
        return this;
    }

    whereToday(field) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return this.whereDateBetween(field, today, tomorrow);
    }

    whereThisWeek(field) {
        const now = new Date();
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 7);
        return this.whereDateBetween(field, startOfWeek, endOfWeek);
    }

    whereThisMonth(field) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);
        return this.whereDateBetween(field, startOfMonth, endOfMonth);
    }

    // ORDER BY operations
    orderBy(field, direction = 'asc') {
        this.orderBy.push({ field, direction });
        return this;
    }

    orderByAsc(field) {
        return this.orderBy(field, 'asc');
    }

    orderByDesc(field) {
        return this.orderBy(field, 'desc');
    }

    // LIMIT and OFFSET
    limit(count) {
        this.limitValue = count;
        return this;
    }

    offset(count) {
        this.offsetValue = count;
        return this;
    }

    // RANGE (Supabase specific)
    range(start, end) {
        this.rangeStart = start;
        this.rangeEnd = end;
        return this;
    }

    // Pagination helper
    paginate(page, pageSize) {
        const offset = (page - 1) * pageSize;
        return this.range(offset, offset + pageSize - 1);
    }

    // JOIN operations (Supabase foreign key syntax)
    joinWith(relationName, fields = '*') {
        if (this.selectFields === '*') {
            this.selectFields = `*, ${relationName}(${fields})`;
        } else {
            this.selectFields += `, ${relationName}(${fields})`;
        }
        return this;
    }

    // Inner join (Supabase !inner syntax)
    innerJoinWith(relationName, fields = '*') {
        if (this.selectFields === '*') {
            this.selectFields = `*, ${relationName}!inner(${fields})`;
        } else {
            this.selectFields += `, ${relationName}!inner(${fields})`;
        }
        return this;
    }

    // Search operations
    search(field, query, options = {}) {
        const { type = 'plain', config = 'english' } = options;
        this.filters.push({ 
            field, 
            operator: 'fts', 
            value: `${query}`,
            type: 'search',
            config,
            searchType: type
        });
        return this;
    }

    // Full text search
    fullTextSearch(field, query) {
        return this.search(field, query, { type: 'websearch' });
    }

    // Aggregation operations
    count(field = '*') {
        this.selectFields = field === '*' ? '*' : field;
        this.isCountQuery = true;
        return this;
    }

    // Conditional operations
    when(condition, callback) {
        if (condition) {
            callback(this);
        }
        return this;
    }

    // Build and execute query
    build() {
        let query = this.supabase.from(this.tableName);

        // Apply SELECT
        if (this.isCountQuery) {
            query = query.select(this.selectFields, { count: 'exact', head: true });
        } else {
            query = query.select(this.selectFields);
        }

        // Apply WHERE conditions
        this.filters.forEach(filter => {
            if (filter.type === 'where') {
                switch (filter.operator) {
                    case 'eq':
                        query = query.eq(filter.field, filter.value);
                        break;
                    case 'neq':
                        query = query.neq(filter.field, filter.value);
                        break;
                    case 'gt':
                        query = query.gt(filter.field, filter.value);
                        break;
                    case 'gte':
                        query = query.gte(filter.field, filter.value);
                        break;
                    case 'lt':
                        query = query.lt(filter.field, filter.value);
                        break;
                    case 'lte':
                        query = query.lte(filter.field, filter.value);
                        break;
                    case 'like':
                        query = query.like(filter.field, filter.value);
                        break;
                    case 'ilike':
                        query = query.ilike(filter.field, filter.value);
                        break;
                    case 'in':
                        query = query.in(filter.field, filter.value);
                        break;
                    case 'not.in':
                        query = query.not(filter.field, 'in', filter.value);
                        break;
                    case 'is':
                        query = query.is(filter.field, filter.value);
                        break;
                    case 'not.is':
                        query = query.not(filter.field, 'is', filter.value);
                        break;
                }
            } else if (filter.type === 'or') {
                const orConditions = filter.conditions.map(cond => 
                    `${cond.field}.${cond.operator}.${cond.value}`
                ).join(',');
                query = query.or(orConditions);
            } else if (filter.type === 'search') {
                query = query.textSearch(filter.field, filter.value, {
                    type: filter.searchType,
                    config: filter.config
                });
            }
        });

        // Apply ORDER BY
        this.orderBy.forEach(order => {
            query = query.order(order.field, { ascending: order.direction === 'asc' });
        });

        // Apply LIMIT
        if (this.limitValue !== null) {
            query = query.limit(this.limitValue);
        }

        // Apply RANGE (takes precedence over LIMIT/OFFSET)
        if (this.rangeStart !== null && this.rangeEnd !== null) {
            query = query.range(this.rangeStart, this.rangeEnd);
        } else if (this.offsetValue !== null && this.limitValue !== null) {
            query = query.range(this.offsetValue, this.offsetValue + this.limitValue - 1);
        }

        return query;
    }

    // Execute methods
    async get() {
        const query = this.build();
        const { data, error } = await query;
        if (error) throw error;
        return data;
    }

    async first() {
        const query = this.build().limit(1);
        const { data, error } = await query.single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    }

    async getCount() {
        const query = this.build();
        const { count, error } = await query;
        if (error) throw error;
        return count;
    }

    async getPaginated() {
        // Get count for pagination info
        const countQuery = this.supabase
            .from(this.tableName)
            .select('*', { count: 'exact', head: true });
        
        // Apply same filters for count
        this.filters.forEach(filter => {
            if (filter.type === 'where') {
                switch (filter.operator) {
                    case 'eq':
                        countQuery.eq(filter.field, filter.value);
                        break;
                    // Add other operators as needed
                }
            }
        });

        const { count, error: countError } = await countQuery;
        if (countError) throw countError;

        // Get actual data
        const data = await this.get();

        return {
            data,
            count,
            hasMore: this.rangeEnd ? this.rangeEnd < count - 1 : false
        };
    }

    // Static factory method
    static for(supabase, tableName) {
        return new QueryBuilder(supabase, tableName);
    }

    // Helper methods for common patterns
    static buildUserQuery(supabase, userId) {
        return new QueryBuilder(supabase, 'users')
            .whereEquals('id', userId)
            .select('id, email, full_name, role, status, created_at');
    }

    static buildVocabularyQuery(supabase, userId) {
        return new QueryBuilder(supabase, 'vocabulary_lists')
            .whereOr([
                { field: 'privacy', operator: 'eq', value: 'public' },
                { field: 'owner_id', operator: 'eq', value: userId }
            ])
            .joinWith('vocabulary_items', 'id, word, meaning')
            .orderByDesc('updated_at');
    }

    static buildReviewQueueQuery(supabase, userId) {
        return new QueryBuilder(supabase, 'user_vocabulary')
            .whereEquals('user_id', userId)
            .whereLessThanOrEqual('next_review_date', new Date().toISOString())
            .joinWith('vocabulary_items', 'id, word, meaning, pronunciation, example_sentence')
            .orderByAsc('next_review_date');
    }
}

module.exports = QueryBuilder;