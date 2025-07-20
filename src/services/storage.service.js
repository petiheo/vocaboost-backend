const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

// Initialize Supabase client with service key for storage operations
const supabaseStorage = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

class StorageService {
  constructor() {
    this.bucketName = 'teacher-credentials';
    this.initializeBucket();
  }

  async initializeBucket() {
    try {
      // Check if bucket exists
      const { data: buckets } = await supabaseStorage.storage.listBuckets();
      const bucketExists = buckets?.some(b => b.name === this.bucketName);

      if (!bucketExists) {
        // Create bucket with appropriate settings
        const { data, error } = await supabaseStorage.storage.createBucket(
          this.bucketName,
          {
            public: false, // Private bucket for sensitive documents
            fileSizeLimit: 10485760, // 10MB limit
            allowedMimeTypes: [
              'image/jpeg',
              'image/png',
              'image/jpg',
              'application/pdf',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ]
          }
        );

        if (error && error.message !== 'Bucket already exists') {
          console.error('Error creating bucket:', error);
        } else {
          console.log('✅ Teacher credentials bucket initialized');
        }
      }
    } catch (error) {
      console.error('Storage initialization error:', error);
    }
  }

  async uploadFile(file, userId) {
    try {
      // Validate file
      if (!file || !file.buffer) {
        throw new Error('Invalid file data');
      }

      // Validate file size (10MB max)
      if (file.size > 10485760) {
        throw new Error('File size exceeds 10MB limit');
      }

      // Generate unique filename
      const timestamp = Date.now();
      const fileExt = path.extname(file.originalname);
      const fileName = `${userId}/${timestamp}-${Math.random().toString(36).substring(7)}${fileExt}`;

      // Upload to Supabase Storage
      const { data, error } = await supabaseStorage.storage
        .from(this.bucketName)
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        });

      if (error) throw error;

      // Generate signed URL (valid for 1 year)
      const { data: urlData } = await supabaseStorage.storage
        .from(this.bucketName)
        .createSignedUrl(data.path, 365 * 24 * 60 * 60);

      return {
        path: data.path,
        url: urlData.signedUrl,
        size: file.size,
        mimetype: file.mimetype,
        originalName: file.originalname
      };
    } catch (error) {
      console.error('File upload error:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  async deleteFile(filePath) {
    try {
      const { error } = await supabaseStorage.storage
        .from(this.bucketName)
        .remove([filePath]);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('File deletion error:', error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  async getSignedUrl(filePath, expiresIn = 3600) {
    try {
      const { data, error } = await supabaseStorage.storage
        .from(this.bucketName)
        .createSignedUrl(filePath, expiresIn);

      if (error) throw error;
      return data.signedUrl;
    } catch (error) {
      console.error('Get signed URL error:', error);
      throw new Error(`Failed to get signed URL: ${error.message}`);
    }
  }

  // Validate file type
  isValidFileType(mimetype) {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/jpg',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    return allowedTypes.includes(mimetype);
  }

  // Get file info
  async getFileInfo(filePath) {
    try {
      const { data, error } = await supabaseStorage.storage
        .from(this.bucketName)
        .list(path.dirname(filePath), {
          limit: 1,
          search: path.basename(filePath)
        });

      if (error) throw error;
      return data[0] || null;
    } catch (error) {
      console.error('Get file info error:', error);
      return null;
    }
  }
}

module.exports = new StorageService();