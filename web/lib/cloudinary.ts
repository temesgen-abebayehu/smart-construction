/**
 * Cloudinary Upload Utility
 * Direct upload from frontend to Cloudinary
 */

// Load from environment variables
const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
const CLOUDINARY_UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'smart-construction'
const CLOUDINARY_API_KEY = process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY

// Validate configuration at module load
if (typeof window !== 'undefined') {
    if (!CLOUDINARY_CLOUD_NAME) {
        console.error('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is not set in environment variables')
    }
    if (!CLOUDINARY_API_KEY) {
        console.error('NEXT_PUBLIC_CLOUDINARY_API_KEY is not set in environment variables')
    }
}

export interface CloudinaryUploadResult {
    public_id: string
    secure_url: string
    width: number
    height: number
    format: string
    resource_type: string
    created_at: string
    bytes: number
}

/**
 * Upload image directly to Cloudinary
 * @param file - File to upload
 * @param folder - Optional folder path in Cloudinary
 * @returns Upload result with secure URL
 */
export async function uploadToCloudinary(
    file: File,
    folder?: string
): Promise<CloudinaryUploadResult> {
    // Validate configuration
    if (!CLOUDINARY_CLOUD_NAME) {
        throw new Error('Cloudinary cloud name is not configured. Please set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME in .env.local')
    }
    if (!CLOUDINARY_API_KEY) {
        throw new Error('Cloudinary API key is not configured. Please set NEXT_PUBLIC_CLOUDINARY_API_KEY in .env.local')
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)
    formData.append('cloud_name', CLOUDINARY_CLOUD_NAME)
    formData.append('api_key', CLOUDINARY_API_KEY)

    if (folder) {
        formData.append('folder', folder)
    }

    // Add timestamp for security
    formData.append('timestamp', String(Math.floor(Date.now() / 1000)))

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
            method: 'POST',
            body: formData,
        }
    )

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: 'Upload failed' } }))
        throw new Error(error.error?.message || 'Failed to upload image to Cloudinary')
    }

    return response.json()
}

/**
 * Delete image from Cloudinary
 * Note: This requires server-side implementation with API secret
 * For now, we'll just return the public_id for backend deletion
 */
export function getPublicIdFromUrl(url: string): string | null {
    try {
        const parts = url.split('/')
        const filename = parts[parts.length - 1]
        const publicId = filename.split('.')[0]
        return publicId
    } catch {
        return null
    }
}

/**
 * Validate image file before upload
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
    const MAX_SIZE = 10 * 1024 * 1024 // 10MB
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

    if (!ALLOWED_TYPES.includes(file.type)) {
        return {
            valid: false,
            error: `Invalid file type. Allowed: ${ALLOWED_TYPES.join(', ')}`
        }
    }

    if (file.size > MAX_SIZE) {
        return {
            valid: false,
            error: `File too large. Maximum size: ${MAX_SIZE / (1024 * 1024)}MB`
        }
    }

    return { valid: true }
}
