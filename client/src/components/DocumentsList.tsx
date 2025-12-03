import { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  File, 
  Trash2, 
  Download, 
  Search, 
  Calendar, 
  FileText,
  HardDrive,
  Edit2,
  X,
  Upload,
  Brain,
  Sparkles
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface Document {
  id: string;
  fileName: string;
  originalName: string;
  fileSize: string;
  mimeType: string;
  summary: string | null;
  keywords: string[] | null;
  uploadedAt: string;
  lastAccessedAt: string;
  isNote?: boolean;
  isPersonality?: boolean;
}

interface DocumentsListProps {
  onClose?: () => void;
}

export function DocumentsList({ onClose }: DocumentsListProps = {}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Query for user documents
  const { data: documents = [], isLoading, error } = useQuery<Document[]>({
    queryKey: ['/api/documents'],
    retry: 1,
  });

  // Migrate documents mutation
  const migrateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/documents/migrate');
    },
    onSuccess: () => {
      toast({
        title: "Documents Migrated",
        description: "All documents have been migrated to your account.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge/stats'] });
    },
    onError: (error: any) => {
      toast({
        title: "Migration Failed",
        description: error.message || "Failed to migrate documents.",
        variant: "destructive",
      });
    },
  });

  // Delete document mutation
  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      return apiRequest('DELETE', `/api/documents/${documentId}`);
    },
    onSuccess: () => {
      toast({
        title: "Document Deleted",
        description: "Document has been removed from your knowledge base.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge/stats'] });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete document.",
        variant: "destructive",
      });
    },
  });

  // Rename document mutation
  const renameMutation = useMutation({
    mutationFn: async ({ documentId, newName }: { documentId: string; newName: string }) => {
      return apiRequest('PATCH', `/api/documents/${documentId}/rename`, { newName });
    },
    onSuccess: () => {
      toast({
        title: "Document Renamed",
        description: "Document name has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      setRenamingId(null);
      setNewName('');
    },
    onError: (error: any) => {
      toast({
        title: "Rename Failed",
        description: error.message || "Failed to rename document.",
        variant: "destructive",
      });
    },
  });

  // Toggle personality training mutation
  const personalityMutation = useMutation({
    mutationFn: async ({ documentId, isPersonality }: { documentId: string; isPersonality: boolean }) => {
      return apiRequest('PATCH', `/api/documents/${documentId}/personality`, { isPersonality });
    },
    onSuccess: (_, variables) => {
      toast({
        title: variables.isPersonality ? "Personality Training Enabled" : "Personality Training Disabled",
        description: variables.isPersonality 
          ? "This document will now shape Archimedes' personality and responses." 
          : "Document removed from personality training.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update document personality setting.",
        variant: "destructive",
      });
    },
  });

  // Search documents mutation
  const searchMutation = useMutation({
    mutationFn: async (query: string) => {
      return apiRequest('POST', '/api/documents/search', { query });
    },
  });

  // Import documents mutation
  const importMutation = useMutation({
    mutationFn: async (importData: { documents: any[] }) => {
      return apiRequest('POST', '/api/documents/import', importData);
    },
    onSuccess: (data: any) => {
      let description = `Imported ${data.imported} documents.`;
      if (data.skipped > 0) {
        description += ` ${data.skipped} skipped (already exist).`;
      }
      if (data.errors && data.errors.length > 0) {
        description += ` ${data.errors.length} failed.`;
      }
      toast({
        title: "Import Complete",
        description,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge/stats'] });
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import documents.",
        variant: "destructive",
      });
    },
  });

  // Handle export - downloads all documents as JSON
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/documents/export', {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Export failed');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `archimedes-documents-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: "Export Complete",
        description: `Exported ${documents.length} documents to JSON file.`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export documents.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Handle import - reads JSON file and imports documents
  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!data.documents || !Array.isArray(data.documents)) {
        throw new Error('Invalid import file format');
      }

      importMutation.mutate({ documents: data.documents });
    } catch (error) {
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to read import file.",
        variant: "destructive",
      });
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (sizeString: string) => {
    const size = parseInt(sizeString);
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (size === 0) return '0 B';
    const i = Math.floor(Math.log(size) / Math.log(1024));
    return Math.round(size / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDelete = (documentId: string, fileName: string) => {
    if (window.confirm(`Are you sure you want to delete "${fileName}"? This action cannot be undone.`)) {
      deleteMutation.mutate(documentId);
    }
  };

  const handleRenameStart = (documentId: string, currentName: string) => {
    setRenamingId(documentId);
    setNewName(currentName);
  };

  const handleRenameSubmit = (documentId: string) => {
    if (!newName.trim()) {
      toast({
        title: "Invalid Name",
        description: "Document name cannot be empty.",
        variant: "destructive",
      });
      return;
    }
    renameMutation.mutate({ documentId, newName: newName.trim() });
  };

  const handleRenameCancel = () => {
    setRenamingId(null);
    setNewName('');
  };

  // Memoize filtered documents to prevent unnecessary recalculations
  const filteredDocuments = useMemo(() => {
    return documents.filter(doc =>
      doc.originalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.keywords?.some(keyword => keyword.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [documents, searchQuery]);


  if (error) {
    return (
      <div className="border rounded-lg p-6 max-w-4xl w-full max-h-[90vh]" data-no-terminal-autofocus style={{
        backgroundColor: 'var(--terminal-bg)',
        borderColor: 'rgba(255, 77, 77, 0.2)'
      }}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold font-mono flex items-center" style={{ color: '#ff4d4d' }}>
            <FileText className="mr-2" size={20} />
            Knowledge Base Documents
          </h2>
          {onClose && (
            <Button onClick={onClose} variant="ghost" size="sm" style={{ color: 'var(--terminal-text)' }}>
              ✕
            </Button>
          )}
        </div>
        <div className="p-4 text-center" style={{ color: '#ff4d4d' }}>
          <p>Error loading documents: {(error as Error).message}</p>
          <p className="text-sm mt-2" style={{ color: 'var(--terminal-text)', opacity: 0.6 }}>
            You may need to log in again to access your documents.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-3 w-full h-full flex flex-col" data-no-terminal-autofocus style={{
      backgroundColor: 'var(--terminal-bg)',
      borderColor: 'rgba(var(--terminal-subtle-rgb), 0.2)'
    }}>
      <div className="flex justify-between items-center mb-2 flex-shrink-0">
        <h2 className="text-base font-bold font-mono flex items-center" style={{ color: 'var(--terminal-text)' }}>
          <FileText className="mr-2" size={16} />
          Documents
        </h2>
        {/* Search Bar */}
        <div className="flex-grow mx-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-terminal-text opacity-50" />
          </div>
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search documents by name, content, or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none font-mono text-sm"
            style={{
              backgroundColor: 'var(--terminal-bg)',
              borderColor: 'rgba(var(--terminal-subtle-rgb), 0.2)',
              color: 'var(--terminal-text)'
            }}
            data-testid="input-document-search"
          />
        </div>
        <Button 
          onClick={async () => {
            try {
              const res = await fetch('/api/documents/diagnostic');
              if (!res.ok) {
                const error = await res.json();
                console.error('Diagnostic error:', error);
                alert(`Diagnostic failed: ${error.error || 'Unknown error'}\n${error.details || ''}`);
                return;
              }
              const data = await res.json();
              console.log('📊 Database Diagnostic:', data);

              const totalDocs = data.totalDocuments ?? 0;
              const yourDocs = data.yourDocuments ?? 0;
              const byUserId = data.documentsByUserId ?? {};

              alert(`Total docs in DB: ${totalDocs}\nYour docs: ${yourDocs}\nYour User ID: ${data.yourUserId}\n\nBy userId:\n${JSON.stringify(byUserId, null, 2)}`);
            } catch (error) {
              console.error('Diagnostic request failed:', error);
              alert('Failed to run diagnostic. Check console for details.');
            }
          }}
          variant="outline" 
          size="sm" 
          className="text-xs mr-2 font-mono"
          style={{
            backgroundColor: 'rgba(var(--terminal-subtle-rgb), 0.15)',
            borderColor: 'rgba(var(--terminal-subtle-rgb), 0.4)',
            color: 'var(--terminal-text)'
          }}
        >
          Check DB
        </Button>
        <Button 
          onClick={() => migrateMutation.mutate()}
          disabled={migrateMutation.isPending}
          variant="outline" 
          size="sm" 
          className="text-xs mr-2 font-mono"
          style={{
            backgroundColor: 'rgba(var(--terminal-subtle-rgb), 0.15)',
            borderColor: 'rgba(var(--terminal-subtle-rgb), 0.4)',
            color: 'var(--terminal-text)'
          }}
        >
          {migrateMutation.isPending ? 'Migrating...' : 'Migrate Docs'}
        </Button>
        <Button 
          onClick={handleExport}
          disabled={isExporting || documents.length === 0}
          variant="outline" 
          size="sm" 
          className="text-xs mr-2 font-mono"
          style={{
            backgroundColor: 'rgba(var(--terminal-subtle-rgb), 0.15)',
            borderColor: 'rgba(var(--terminal-subtle-rgb), 0.4)',
            color: 'var(--terminal-text)'
          }}
          data-testid="button-export-documents"
        >
          <Download size={14} className="mr-1" />
          {isExporting ? 'Exporting...' : 'Export'}
        </Button>
        <Button 
          onClick={() => fileInputRef.current?.click()}
          disabled={importMutation.isPending}
          variant="outline" 
          size="sm" 
          className="text-xs mr-2 font-mono"
          style={{
            backgroundColor: 'rgba(var(--terminal-subtle-rgb), 0.15)',
            borderColor: 'rgba(var(--terminal-subtle-rgb), 0.4)',
            color: 'var(--terminal-text)'
          }}
          data-testid="button-import-documents"
        >
          <Upload size={14} className="mr-1" />
          {importMutation.isPending ? 'Importing...' : 'Import'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImportFile}
          className="hidden"
          data-testid="input-import-file"
        />
        {onClose && (
          <Button 
            onClick={onClose} 
            variant="outline" 
            size="sm" 
            className="hover:opacity-80"
            style={{
              backgroundColor: 'rgba(var(--terminal-subtle-rgb), 0.15)',
              borderColor: 'rgba(var(--terminal-subtle-rgb), 0.4)',
              color: 'var(--terminal-text)'
            }}
          >
            <X size={18} />
          </Button>
        )}
      </div>

      {/* Documents Count - v2 */}
      <div className="mb-4 text-sm flex-shrink-0" style={{ color: 'var(--terminal-text)', opacity: 0.6 }}>
        {isLoading ? (
          <span>Loading documents...</span>
        ) : (
          <span>
            Showing {filteredDocuments.length} of {documents.length} document{documents.length !== 1 ? 's' : ''}
            {searchQuery && ` matching "${searchQuery}"`}
          </span>
        )}
      </div>

      {/* Documents List */}
      <ScrollArea className="flex-1 pr-4">
        {isLoading ? (
          <div className="text-center py-8" style={{ color: 'var(--terminal-text)', opacity: 0.6 }}>
            <HardDrive className="mx-auto mb-2" size={24} />
            Loading your documents...
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="text-center py-8" style={{ color: 'var(--terminal-text)', opacity: 0.6 }}>
            {documents.length === 0 ? (
              <>
                <FileText className="mx-auto mb-2" size={24} />
                <p>No documents uploaded yet.</p>
                <p className="text-sm mt-2">Upload documents to build your knowledge base.</p>
              </>
            ) : (
              <>
                <Search className="mx-auto mb-2" size={24} />
                <p>No documents match your search.</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDocuments.map((document) => (
              <div
                key={document.id}
                className="border rounded-lg p-4 transition-colors"
                style={{
                  borderColor: 'rgba(var(--terminal-subtle-rgb), 0.3)',
                  backgroundColor: 'var(--terminal-bg)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(var(--terminal-subtle-rgb), 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(var(--terminal-subtle-rgb), 0.3)';
                }}
                data-testid={`document-item-${document.id}`}
              >
                <div className="flex flex-col gap-3">
                  {/* Document info row */}
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--terminal-highlight)' }} />
                    <div className="flex-1 min-w-0">
                      {renamingId === document.id ? (
                        <form onSubmit={(e) => {
                          e.preventDefault();
                          handleRenameSubmit(document.id);
                        }} className="flex flex-wrap gap-2">
                          <Input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleRenameSubmit(document.id);
                              } else if (e.key === 'Escape') {
                                handleRenameCancel();
                              }
                            }}
                            autoFocus
                            className="flex-1 min-w-[150px] px-2 py-1 rounded font-mono text-sm h-8"
                            style={{
                              backgroundColor: 'var(--terminal-bg)',
                              color: 'var(--terminal-text)',
                              borderColor: 'var(--terminal-highlight)'
                            }}
                          />
                          <Button
                            type="submit"
                            size="sm"
                            className="h-8 px-3"
                            style={{ backgroundColor: 'var(--terminal-highlight)', color: 'var(--terminal-bg)' }}
                            disabled={renameMutation.isPending}
                          >
                            Save
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleRenameCancel}
                            className="h-8 px-3"
                            style={{ borderColor: 'var(--terminal-subtle)', color: 'var(--terminal-text)' }}
                          >
                            Cancel
                          </Button>
                        </form>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-mono font-semibold truncate" style={{ color: 'var(--terminal-text)' }}>
                              {document.originalName}
                            </p>
                            {document.isNote && (
                              <span 
                                className="px-2 py-0.5 text-xs font-mono rounded"
                                style={{ 
                                  backgroundColor: 'var(--terminal-highlight)', 
                                  color: 'var(--terminal-bg)',
                                  opacity: 0.8
                                }}
                              >
                                NOTE
                              </span>
                            )}
                            {document.isPersonality && (
                              <span 
                                className="px-2 py-0.5 text-xs font-mono rounded flex items-center gap-1"
                                style={{ 
                                  backgroundColor: 'rgba(168, 85, 247, 0.9)', 
                                  color: 'white',
                                }}
                              >
                                <Brain size={12} />
                                PERSONALITY
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-mono opacity-70" style={{ color: 'var(--terminal-text)' }}>
                            {formatFileSize(document.fileSize)} • {document.mimeType} • {new Date(document.uploadedAt).toLocaleDateString()}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Action buttons row - always visible */}
                  <div className="flex items-center gap-2 pl-8 flex-wrap">
                    <Button
                      onClick={() => personalityMutation.mutate({ 
                        documentId: document.id, 
                        isPersonality: !document.isPersonality 
                      })}
                      variant="outline"
                      size="sm"
                      title={document.isPersonality ? "Remove from personality training" : "Use for personality training"}
                      className="h-8 px-3 font-mono hover:bg-opacity-20"
                      style={{ 
                        backgroundColor: document.isPersonality 
                          ? 'rgba(168, 85, 247, 0.25)' 
                          : 'rgba(168, 85, 247, 0.1)',
                        borderColor: document.isPersonality 
                          ? 'rgba(168, 85, 247, 0.8)' 
                          : 'rgba(168, 85, 247, 0.4)',
                        color: '#a855f7'
                      }}
                      disabled={personalityMutation.isPending || renamingId !== null}
                      data-testid={`button-personality-${document.id}`}
                    >
                      {document.isPersonality ? (
                        <>
                          <Brain size={16} className="mr-1" />
                          Training ON
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} className="mr-1" />
                          Train AI
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => handleRenameStart(document.id, document.originalName)}
                      variant="outline"
                      size="sm"
                      title="Rename document"
                      className="h-8 px-3 font-mono hover:bg-opacity-20"
                      style={{ 
                        backgroundColor: 'rgba(100, 200, 255, 0.15)',
                        borderColor: 'rgba(100, 200, 255, 0.5)',
                        color: '#60d0ff'
                      }}
                      disabled={renamingId !== null || deleteMutation.isPending}
                      data-testid={`button-rename-${document.id}`}
                    >
                      <Edit2 size={16} className="mr-1" />
                      Rename
                    </Button>
                    <Button
                      onClick={() => handleDelete(document.id, document.originalName)}
                      variant="outline"
                      size="sm"
                      title="Delete document"
                      className="h-8 px-3 font-mono hover:bg-opacity-20"
                      style={{ 
                        backgroundColor: 'rgba(239, 68, 68, 0.15)',
                        borderColor: 'rgba(239, 68, 68, 0.5)',
                        color: '#ff6b6b'
                      }}
                      disabled={deleteMutation.isPending || renamingId !== null}
                      data-testid={`button-delete-${document.id}`}
                    >
                      <Trash2 size={16} className="mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer with stats */}
      {documents.length > 0 && (
        <div className="mt-4 pt-4 border-t flex-shrink-0" style={{ borderColor: 'rgba(var(--terminal-subtle-rgb), 0.3)' }}>
          <div className="text-xs flex justify-between" style={{ color: 'var(--terminal-text)', opacity: 0.6 }}>
            <span>
              Total size: {formatFileSize(
                documents.reduce((sum, doc) => sum + parseInt(doc.fileSize), 0).toString()
              )}
            </span>
            <span>
              Last updated: {formatDate(
                documents.sort((a, b) => 
                  new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
                )[0]?.uploadedAt || ''
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}