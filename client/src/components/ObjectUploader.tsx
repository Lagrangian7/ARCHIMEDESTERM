// Object Uploader component for knowledge base file uploads
// Simplified implementation using native file input

import { useState, useRef } from "react";
import type { ReactNode, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, FileText, Loader2 } from "lucide-react";

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onGetUploadParameters: () => Promise<{
    method: "PUT";
    url: string;
  }>;
  onComplete?: (result: { successful: Array<{ name: string }> }) => void;
  buttonClassName?: string;
  children: ReactNode;
}

const ALLOWED_FILE_TYPES = [
  '.pdf', '.doc', '.docx', '.txt', '.md', 
  '.epub', '.mobi', '.json', '.csv',
  '.mp3', '.wav', '.ogg', '.m4a'
];

export function ObjectUploader({
  maxNumberOfFiles = 10,
  maxFileSize = 26214400,
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  children,
}: ObjectUploaderProps) {
  const [showModal, setShowModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setError(null);
    
    if (files.length > maxNumberOfFiles) {
      setError(`Maximum ${maxNumberOfFiles} files allowed`);
      return;
    }

    const oversizedFiles = files.filter(f => f.size > maxFileSize);
    if (oversizedFiles.length > 0) {
      setError(`Some files exceed the ${Math.round(maxFileSize / 1024 / 1024)}MB limit`);
      return;
    }

    setSelectedFiles(files);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    
    setUploading(true);
    setError(null);
    
    try {
      const successful: Array<{ name: string }> = [];
      
      for (const file of selectedFiles) {
        const params = await onGetUploadParameters();
        const response = await fetch(params.url, {
          method: params.method,
          body: file,
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
          },
        });
        
        if (response.ok) {
          successful.push({ name: file.name });
        } else {
          throw new Error(`Failed to upload ${file.name}`);
        }
      }
      
      onComplete?.({ successful });
      setShowModal(false);
      setSelectedFiles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div>
      <Button 
        onClick={() => setShowModal(true)} 
        className={buttonClassName}
        data-testid="button-upload-knowledge-file"
      >
        {children}
      </Button>

      {showModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" 
          onClick={() => setShowModal(false)}
        >
          <div 
            className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Upload Files</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ALLOWED_FILE_TYPES.join(',')}
              onChange={handleFileChange}
              className="hidden"
            />

            <div 
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Click to select files or drag and drop
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PDF, DOC, TXT, MD, Audio files up to {Math.round(maxFileSize / 1024 / 1024)}MB
              </p>
            </div>

            {selectedFiles.length > 0 && (
              <div className="mt-4 space-y-2 max-h-40 overflow-y-auto">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeFile(index)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <p className="mt-2 text-sm text-destructive">{error}</p>
            )}

            <div className="mt-4 flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleUpload} 
                disabled={selectedFiles.length === 0 || uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Upload'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
