// models/repositories/base/BaseRepository.js
const supabase = require('../../../config/database');

class BaseRepository {
    constructor(tableName) {
        this.tableName = tableName;
        this.supabase = supabase;
    }

    // CREATE operations
    async create(data) {
        const { data: result, error } = await this.supabase
            .from(this.tableName)
            .insert(data)
            .select()
            .single();
            
        if (error) throw error;
        return result;
    }

    async createMany(dataArray) {
        const { data: result, error } = await this.supabase
            .from(this.tableName)
            .insert(dataArray)
            .select();
            
        if (error) throw error;
        return result;
    }

    // READ operations
    async findById(id) {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select('*')
            .eq('id', id)
            .single();
            
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    }

    async findAll(options = {}) {
        let query = this.supabase.from(this.tableName).select('*');
        
        // Apply filters
        if (options.where) {
            Object.entries(options.where).forEach(([key, value]) => {
                query = query.eq(key, value);
            });
        }
        
        // Apply ordering
        if (options.orderBy) {
            const { field, direction = 'asc' } = options.orderBy;
            query = query.order(field, { ascending: direction === 'asc' });
        }
        
        // Apply pagination
        if (options.limit) {
            query = query.limit(options.limit);
        }
        
        if (options.offset) {
            query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return data;
    }

    async findOne(conditions) {
        let query = this.supabase.from(this.tableName).select('*');
        
        Object.entries(conditions).forEach(([key, value]) => {
            query = query.eq(key, value);
        });
        
        const { data, error } = await query.single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    }

    async count(conditions = {}) {
        let query = this.supabase
            .from(this.tableName)
            .select('*', { count: 'exact', head: true });
            
        Object.entries(conditions).forEach(([key, value]) => {
            query = query.eq(key, value);
        });
        
        const { count, error } = await query;
        if (error) throw error;
        return count;
    }

    // UPDATE operations
    async update(id, data) {
        const updates = {
            ...data,
            updated_at: new Date()
        };
        
        const { data: result, error } = await this.supabase
            .from(this.tableName)
            .update(updates)
            .eq('id', id)
            .select()
            .single();
            
        if (error) throw error;
        return result;
    }

    async updateMany(conditions, data) {
        let query = this.supabase
            .from(this.tableName)
            .update({
                ...data,
                updated_at: new Date()
            });
            
        Object.entries(conditions).forEach(([key, value]) => {
            query = query.eq(key, value);
        });
        
        const { data: result, error } = await query.select();
        if (error) throw error;
        return result;
    }

    async upsert(data, onConflict = 'id') {
        const { data: result, error } = await this.supabase
            .from(this.tableName)
            .upsert(data, { onConflict })
            .select()
            .single();
            
        if (error) throw error;
        return result;
    }

    // DELETE operations
    async delete(id) {
        const { error } = await this.supabase
            .from(this.tableName)
            .delete()
            .eq('id', id);
            
        if (error) throw error;
        return true;
    }

    async deleteMany(conditions) {
        let query = this.supabase.from(this.tableName).delete();
        
        Object.entries(conditions).forEach(([key, value]) => {
            query = query.eq(key, value);
        });
        
        const { error } = await query;
        if (error) throw error;
        return true;
    }

    // ADVANCED operations
    async exists(conditions) {
        try {
            const result = await this.findOne(conditions);
            return !!result;
        } catch (error) {
            return false;
        }
    }

    async paginate(page = 1, limit = 20, options = {}) {
        const offset = (page - 1) * limit;
        
        // Get total count
        const total = await this.count(options.where || {});
        
        // Get paginated data
        const data = await this.findAll({
            ...options,
            limit,
            offset
        });
        
        return {
            data,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit),
                hasNextPage: page * limit < total,
                hasPrevPage: page > 1
            }
        };
    }

    // TRANSACTION support
    async transaction(callback) {
        // Note: Supabase doesn't have explicit transactions
        // This is a placeholder for potential future implementation
        return await callback(this.supabase);
    }

    // RELATION operations
    async findWithRelations(id, relations = []) {
        let selectString = '*';
        
        if (relations.length > 0) {
            const relationSelects = relations.map(rel => {
                if (typeof rel === 'string') {
                    return `${rel}(*)`;
                } else if (typeof rel === 'object') {
                    return `${rel.table}(${rel.select || '*'})`;
                }
                return '';
            }).filter(Boolean);
            
            if (relationSelects.length > 0) {
                selectString = `*, ${relationSelects.join(', ')}`;
            }
        }
        
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select(selectString)
            .eq('id', id)
            .single();
            
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    }
}

module.exports = BaseRepository;