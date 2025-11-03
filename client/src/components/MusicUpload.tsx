
import React, { useState, useRef } from "react";
import { Upload, Music, X, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface MusicUploadProps {
  onUploadComplete?: (fileName: string, fileUrl: string) => void;
}

export function MusicUpload({ onUploadComplete }: MusicUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      const successCount = data.totalUploaded || 0;
      const errorCount = data.totalErrors || 0;

      toast({
        title: successCount > 0 ? "Music Uploaded" : "Upload Failed",
        description: errorCount > 0
          ? `${successCount} tracks uploaded, ${errorCount} failed.`
          : `${successCount} track${successCount !== 1 ? 's' : ''} successfully uploaded and ready for Webamp!`,
        variant: errorCount > 0 && successCount === 0 ? "destructive" : "default",
      });

      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });

      // Call onUploadComplete for each uploaded MP3
      if (data.documents && data.documents.length > 0) {
        data.documents.forEach((doc: any) => {
          if (doc.originalName.toLowerCase().endsWith('.mp3')) {
            onUploadComplete?.(doc.originalName, `/api/documents/${doc.id}/download`);
          }
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload music. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFilesSelect = (files: FileList | File[]) => {
    const validFiles: File[] = [];
    const fileArray = Array.from(files);

    if (selectedFiles.length + fileArray.length > 10) {
      toast({
        title: "Too Many Files",
        description: "You can upload a maximum of 10 files at once.",
        variant: "destructive",
      });
      return;
    }

    for (const file of fileArray) {
      if (selectedFiles.some(existing => existing.name === file.name && existing.size === file.size)) {
        continue;
      }

      if (!file.name.toLowerCase().endsWith('.mp3') && !file.type.includes('audio/mpeg')) {
        toast({
          title: "Invalid File Type",
          description: `${file.name}: Only MP3 files are allowed.`,
          variant: "destructive",
        });
        continue;
      }

      const maxSize = 25 * 1024 * 1024; // 25MB
      if (file.size > maxSize) {
        toast({
          title: "File Too Large",
          description: `${file.name}: File must be smaller than 25MB. Current size: ${formatFileSize(file.size)}`,
          variant: "destructive",
        });
        continue;
      }

      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFilesSelect(files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFilesSelect(files);
    }
  };

  const handleUpload = () => {
    if (selectedFiles.length > 0) {
      uploadMutation.mutate(selectedFiles);
    }
  };

  const clearAllFiles = () => {
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <div
        className="border-2 border-dashed rounded-lg p-8 text-center transition-colors"
        style={dragOver ? {
          borderColor: 'rgba(var(--terminal-subtle-rgb), 0.3)',
          backgroundColor: 'rgba(var(--terminal-subtle-rgb), 0.05)'
        } : {
          borderColor: 'rgba(156, 163, 175, 0.25)'
        }}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
      >
        {selectedFiles.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium" style={{ color: 'var(--terminal-text)' }}>
                Selected Tracks ({selectedFiles.length}/10)
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFiles}
                className="hover:opacity-100"
                style={{ color: 'var(--terminal-text)', opacity: 0.7 }}
              >
                Clear All
              </Button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {selectedFiles.map((file, index) => (
                <Card key={`${file.name}-${index}`} className="bg-background/50" style={{ borderColor: 'rgba(var(--terminal-subtle-rgb), 0.2)' }}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Music className="h-6 w-6" style={{ color: 'var(--terminal-highlight)' }} />
                        <div className="flex-1 text-left">
                          <h4 className="font-medium text-sm" style={{ color: 'var(--terminal-text)' }}>
                            {file.name}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs" style={{ color: 'var(--terminal-text)', opacity: 0.7 }}>
                              {formatFileSize(file.size)}
                            </p>
                            <Badge variant="outline" className="text-xs" style={{ color: 'var(--terminal-text)', opacity: 0.7 }}>
                              MP3
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        className="hover:opacity-100"
                        style={{ color: 'var(--terminal-text)', opacity: 0.7 }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex gap-2 justify-center">
              <Button
                onClick={handleUpload}
                disabled={uploadMutation.isPending}
                className="font-mono"
                style={{ backgroundColor: 'var(--terminal-highlight)', color: 'black' }}
              >
                {uploadMutation.isPending ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-t-transparent rounded-full mr-2" style={{ borderColor: 'black' }} />
                    Uploading {selectedFiles.length} track{selectedFiles.length !== 1 ? 's' : ''}...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload to Webamp ({selectedFiles.length} track{selectedFiles.length !== 1 ? 's' : ''})
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="mx-auto h-12 w-12" style={{ color: 'var(--terminal-highlight)' }}>
              <Music className="h-full w-full" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-medium" style={{ color: 'var(--terminal-text)' }}>
                Upload Music to Webamp
              </h3>
              <p style={{ color: 'var(--terminal-text)', opacity: 0.7 }}>
                Drag & drop MP3 files here, or click to browse
              </p>
              <p className="text-sm" style={{ color: 'var(--terminal-text)', opacity: 0.7 }}>
                Supports: MP3 files (max 25MB) - up to 10 files
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              style={{ borderColor: 'rgba(var(--terminal-subtle-rgb), 0.5)', color: 'var(--terminal-text)' }}
            >
              Browse Music Files
            </Button>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        accept=".mp3,audio/mpeg"
        onChange={handleFileInputChange}
      />

      {uploadMutation.isError && (
        <div className="flex items-center space-x-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>Upload failed. Please try again.</span>
        </div>
      )}

      {uploadMutation.isSuccess && (
        <div className="flex items-center space-x-2 text-sm" style={{ color: 'var(--terminal-text)' }}>
          <CheckCircle className="h-4 w-4" />
          <span>Music uploaded and added to Webamp playlist!</span>
        </div>
      )}
    </div>
  );
}
