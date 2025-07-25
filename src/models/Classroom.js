const supabase = require('../config/database');

class Classroom {
    static async create(classroomData) {
        const { data, error } = await supabase
            .from('classrooms')
            .insert(classroomData)
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }
    
    static async findById(id) {
        const { data, error } = await supabase
            .from('classrooms')
            .select(`
                *,
                teacher:users!teacher_id(full_name, email),
                learners:classroom_learners(
                    learner:users!learner_id(id, full_name, email)
                )
            `)
            .eq('id', id)
            .single();
            
        if (error) throw error;
        return data;
    }
    
    static async findByTeacher(teacherId) {
        const { data, error } = await supabase
            .from('classrooms')
            .select(`
                *,
                learner_count:classroom_learners(count)
            `)
            .eq('teacher_id', teacherId)
            .eq('is_active', true);
            
        if (error) throw error;
        return data;
    }
    
    static async findByLearner(learnerId) {
        const { data, error } = await supabase
            .from('classroom_learners')
            .select(`
                classroom:classrooms(
                    *,
                    teacher:users!teacher_id(full_name)
                )
            `)
            .eq('learner_id', learnerId)
            .eq('status', 'active');
            
        if (error) throw error;
        return data?.map(item => item.classroom) || [];
    }
    
    static async findByCode(classCode) {
        const { data, error } = await supabase
            .from('classrooms')
            .select('*')
            .eq('class_code', classCode)
            .eq('is_active', true)
            .single();
            
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    }
    
    static async update(id, updates) {
        const { data, error } = await supabase
            .from('classrooms')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }
    
    static async addLearner(classroomId, learnerId) {
        const { data, error } = await supabase
            .from('classroom_learners')
            .insert({
                classroom_id: classroomId,
                learner_id: learnerId,
                status: 'active'
            })
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }
    
    static async removeLearner(classroomId, learnerId) {
        const { error } = await supabase
            .from('classroom_learners')
            .update({
                status: 'removed',
                left_at: new Date()
            })
            .eq('classroom_id', classroomId)
            .eq('learner_id', learnerId);
            
        if (error) throw error;
        return true;
    }

    static async exists(classroomId) {
        try {
            const { data, error } = await supabase
                .from('classrooms')
                .select('id')
                .eq('id', classroomId)
                .single();
            
            return !error && data !== null;
        } catch (error) {
            console.error('Check classroom exists error:', error);
            return false;
        }
    }

    static async isTeacher(classroomId, userId) {
        try {
            const { data, error } = await supabase
                .from('classrooms')
                .select('teacher_id')
                .eq('id', classroomId)
                .eq('teacher_id', userId)
                .single();
            
            return !error && data !== null;
        } catch (error) {
            console.error('Check teacher error:', error);
            return false;
        }
    }

    static async isActiveLearner(classroomId, userId) {
        try {
            const { data, error } = await supabase
                .from('classroom_learners')
                .select('id')
                .eq('classroom_id', classroomId)
                .eq('learner_id', userId)
                .eq('status', 'active')
                .single();
            
            return !error && data !== null;
        } catch (error) {
            console.error('Check learner error:', error);
            return false;
        }
    }

    static async checkUserAccess(userId, classroomId, userRole) {
        try {
            // Admin always has access
            if (userRole === 'admin') {
                const exists = await this.exists(classroomId);
                return { 
                    hasAccess: exists, 
                    accessType: exists ? 'admin' : null,
                    exists 
                };
            }

            // Check if classroom exists and get teacher_id
            const { data: classroom, error } = await supabase
                .from('classrooms')
                .select('teacher_id')
                .eq('id', classroomId)
                .single();

            if (error || !classroom) {
                return { 
                    hasAccess: false, 
                    accessType: null,
                    exists: false 
                };
            }

            // Check if user is the teacher
            if (classroom.teacher_id === userId) {
                return { 
                    hasAccess: true, 
                    accessType: 'teacher',
                    exists: true 
                };
            }

            // Check if user is an active learner
            const isLearner = await this.isActiveLearner(classroomId, userId);
            if (isLearner) {
                return { 
                    hasAccess: true, 
                    accessType: 'learner',
                    exists: true 
                };
            }

            return { 
                hasAccess: false, 
                accessType: null,
                exists: true 
            };

        } catch (error) {
            console.error('Check user access error:', error);
            throw new Error('Failed to check classroom access');
        }
    }

    static async getUserClassroomRole(userId, classroomId) {
        try {
            const isTeacher = await this.isTeacher(classroomId, userId);
            if (isTeacher) return 'teacher';

            const isLearner = await this.isActiveLearner(classroomId, userId);
            if (isLearner) return 'learner';

            return null;
        } catch (error) {
            console.error('Get classroom role error:', error);
            return null;
        }
    }

    static async findByIdWithAccess(classroomId, userId) {
        try {
            const classroom = await this.findById(classroomId);
            if (!classroom) return null;

            const userRole = await this.getUserClassroomRole(userId, classroomId);
            
            return {
                ...classroom,
                userAccess: {
                    role: userRole,
                    isTeacher: userRole === 'teacher',
                    isLearner: userRole === 'learner',
                    canEdit: userRole === 'teacher',
                    canViewAnalytics: userRole === 'teacher'
                }
            };
        } catch (error) {
            console.error('Find classroom with access error:', error);
            return null;
        }
    }
}

module.exports = Classroom;