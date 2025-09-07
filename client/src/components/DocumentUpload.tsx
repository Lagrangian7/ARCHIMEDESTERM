import React, { useState, useRef } from "react";
import { Upload, FileText, X, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface DocumentInfo {
  id: string;
  originalName: string;
  fileSize: string;
  summary: string | null;
  keywords: string[] | null;
  uploadedAt: string;
}

interface DocumentUploadProps {
  onUploadComplete?: (document: DocumentInfo) => void;
}

export function DocumentUpload({ onUploadComplete }: DocumentUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
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
      toast({
        title: "Document Uploaded",
        description: `${selectedFile?.name} has been successfully processed and added to your knowledge base.`,
      });
      
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Invalidate document queries
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge/stats'] });
      
      onUploadComplete?.(data.document);
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload document. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (file: File) => {
    // Validate file type
    const allowedTypes = ['text/plain', 'text/markdown', 'text/csv', 'application/json', 'text/html', 'text/xml'];
    const allowedExtensions = /\.(txt|md|json|csv|html|xml)$/i;
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.test(file.name)) {
      toast({
        title: "Invalid File Type",
        description: "Only text files are allowed (TXT, MD, JSON, CSV, HTML, XML).",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "File must be smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4" data-testid="document-upload-container">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragOver
            ? 'border-[#00FF41] bg-[#00FF41]/5'
            : 'border-muted-foreground/25 hover:border-[#00FF41]/50'
        }`}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        data-testid="drop-zone"
      >
        {selectedFile ? (
          <div className="space-y-4">
            <Card className="bg-background/50 border-[#00FF41]/20">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <FileText className="h-8 w-8 text-[#00FF41] mt-1" />
                    <div className="flex-1 text-left">
                      <h3 className="font-medium text-foreground" data-testid="selected-file-name">
                        {selectedFile.name}
                      </h3>
                      <p className="text-sm text-muted-foreground" data-testid="selected-file-size">
                        {formatFileSize(selectedFile.size)}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {selectedFile.type || 'Unknown type'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSelection}
                    className="text-muted-foreground hover:text-foreground"
                    data-testid="clear-selection-button"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2 justify-center">
              <Button
                onClick={handleUpload}
                disabled={uploadMutation.isPending}
                className="bg-[#00FF41] hover:bg-[#00FF41]/80 text-black font-mono"
                data-testid="upload-button"
              >
                {uploadMutation.isPending ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-black border-t-transparent rounded-full mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload & Process
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="mx-auto h-12 w-12 text-muted-foreground">
              <Upload className="h-full w-full" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-medium text-foreground">
                Upload Knowledge Document
              </h3>
              <p className="text-muted-foreground">
                Drag & drop a text file here, or click to browse
              </p>
              <p className="text-sm text-muted-foreground">
                Supports: TXT, MD, JSON, CSV, HTML, XML (max 5MB)
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="border-[#00FF41]/50 text-[#00FF41] hover:bg-[#00FF41]/10"
              data-testid="browse-files-button"
            >
              Browse Files
            </Button>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".txt,.md,.json,.csv,.html,.xml"
        onChange={handleFileInputChange}
        data-testid="file-input"
      />

      {/* Status indicators */}
      <div className="space-y-2">
        {uploadMutation.isError && (
          <div className="flex items-center space-x-2 text-destructive text-sm" data-testid="error-message">
            <AlertCircle className="h-4 w-4" />
            <span>Upload failed. Please try again.</span>
          </div>
        )}
        
        {uploadMutation.isSuccess && (
          <div className="flex items-center space-x-2 text-[#00FF41] text-sm" data-testid="success-message">
            <CheckCircle className="h-4 w-4" />
            <span>Document successfully uploaded and processed!</span>
          </div>
        )}
      </div>
    </div>
  );
}