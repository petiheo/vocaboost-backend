// models/Classroom.js
const supabase = require('../config/database');

class Classroom {
    // Existing methods...
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
                students:classroom_students(
                    student:users!student_id(id, full_name, email)
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
                student_count:classroom_students(count)
            `)
            .eq('teacher_id', teacherId)
            .eq('is_active', true);
            
        if (error) throw error;
        return data;
    }
    
    static async findByStudent(studentId) {
        const { data, error } = await supabase
            .from('classroom_students')
            .select(`
                classroom:classrooms(
                    *,
                    teacher:users!teacher_id(full_name)
                )
            `)
            .eq('student_id', studentId)
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
    
    static async addStudent(classroomId, studentId) {
        const { data, error } = await supabase
            .from('classroom_students')
            .insert({
                classroom_id: classroomId,
                student_id: studentId,
                status: 'active'
            })
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }
    
    static async removeStudent(classroomId, studentId) {
        const { error } = await supabase
            .from('classroom_students')
            .update({
                status: 'removed',
                left_at: new Date()
            })
            .eq('classroom_id', classroomId)
            .eq('student_id', studentId);
            
        if (error) throw error;
        return true;
    }

    // NEW METHODS FOR ACCESS CONTROL

    /**
     * Check if a classroom exists
     * @param {string} classroomId 
     * @returns {boolean}
     */
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

    /**
     * Check if user is teacher of classroom
     * @param {string} classroomId 
     * @param {string} userId 
     * @returns {boolean}
     */
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

    /**
     * Check if user is active student in classroom
     * @param {string} classroomId 
     * @param {string} userId 
     * @returns {boolean}
     */
    static async isActiveStudent(classroomId, userId) {
        try {
            const { data, error } = await supabase
                .from('classroom_students')
                .select('id')
                .eq('classroom_id', classroomId)
                .eq('student_id', userId)
                .eq('status', 'active')
                .single();
            
            return !error && data !== null;
        } catch (error) {
            console.error('Check student error:', error);
            return false;
        }
    }

    /**
     * Check if user has any access to classroom
     * @param {string} userId - User ID to check
     * @param {string} classroomId - Classroom ID to check
     * @param {string} userRole - User's system role (for admin check)
     * @returns {Object} { hasAccess: boolean, accessType: 'admin'|'teacher'|'student'|null, exists: boolean }
     */
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

            // Check if user is an active student
            const isStudent = await this.isActiveStudent(classroomId, userId);
            if (isStudent) {
                return { 
                    hasAccess: true, 
                    accessType: 'student',
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

    /**
     * Get user's role in a specific classroom
     * @param {string} userId 
     * @param {string} classroomId 
     * @returns {string|null} 'teacher', 'student', or null
     */
    static async getUserClassroomRole(userId, classroomId) {
        try {
            const isTeacher = await this.isTeacher(classroomId, userId);
            if (isTeacher) return 'teacher';

            const isStudent = await this.isActiveStudent(classroomId, userId);
            if (isStudent) return 'student';

            return null;
        } catch (error) {
            console.error('Get classroom role error:', error);
            return null;
        }
    }

    /**
     * Get classroom with access info for a specific user
     * @param {string} classroomId 
     * @param {string} userId 
     * @returns {Object|null} Classroom with user's access info
     */
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
                    isStudent: userRole === 'student',
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