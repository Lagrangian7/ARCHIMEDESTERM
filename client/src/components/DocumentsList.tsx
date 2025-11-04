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
  X // Import X icon
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
}

interface DocumentsListProps {
  onClose?: () => void;
}

export function DocumentsList({ onClose }: DocumentsListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Query for user documents
  const { data: documents = [], isLoading, error } = useQuery<Document[]>({
    queryKey: ['/api/documents'],
    retry: 1,
    onSuccess: (data) => {
      console.log(`📚 Loaded ${data.length} documents from knowledge base`);
    },
    onError: (err) => {
      console.error('Failed to load documents:', err);
    }
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

  // Search documents mutation
  const searchMutation = useMutation({
    mutationFn: async (query: string) => {
      return apiRequest('POST', '/api/documents/search', { query });
    },
  });

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
    <div className="border rounded-lg p-6 max-w-4xl w-full max-h-[90vh]" data-no-terminal-autofocus style={{
      backgroundColor: 'var(--terminal-bg)',
      borderColor: 'rgba(var(--terminal-subtle-rgb), 0.2)'
    }}>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold font-mono flex items-center" style={{ color: 'var(--terminal-text)' }}>
          <FileText className="mr-2" size={20} />
          Knowledge Base Documents
        </h2>
        {/* Search Bar */}
        <div className="mb-4 flex-grow mx-4"> {/* Added flex-grow and margin */}
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
          onClick={() => migrateMutation.mutate()}
          disabled={migrateMutation.isPending}
          variant="ghost" 
          size="sm" 
          className="text-terminal-highlight hover:bg-terminal-highlight/20 text-xs"
        >
          {migrateMutation.isPending ? 'Migrating...' : 'Migrate Docs'}
        </Button>
        {onClose && (
          <Button onClick={onClose} variant="ghost" size="sm" className="text-terminal-text hover:bg-terminal-highlight/20">
            <X size={18} />
          </Button>
        )}
      </div>

      {/* Documents Count */}
      <div className="mb-4 text-sm" style={{ color: 'var(--terminal-text)', opacity: 0.6 }}>
        {isLoading ? (
          <span>Loading documents...</span>
        ) : (
          <span>
            {filteredDocuments.length} of {documents.length} document{documents.length !== 1 ? 's' : ''}
            {searchQuery && ` matching "${searchQuery}"`}
          </span>
        )}
      </div>

      {/* Documents List */}
      <ScrollArea className="h-[500px] pr-4">
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
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      <File className="flex-shrink-0" style={{ color: 'var(--terminal-text)' }} size={16} />
                      {renamingId === document.id ? (
                        <div className="flex items-center space-x-2 flex-1">
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
                            className="text-sm h-7"
                            style={{
                              backgroundColor: 'var(--terminal-bg)',
                              borderColor: 'var(--terminal-highlight)',
                              color: 'var(--terminal-text)'
                            }}
                          />
                          <Button
                            onClick={() => handleRenameSubmit(document.id)}
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-terminal-highlight"
                            disabled={renameMutation.isPending}
                          >
                            ✓
                          </Button>
                          <Button
                            onClick={handleRenameCancel}
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-terminal-text"
                          >
                            ✕
                          </Button>
                        </div>
                      ) : (
                        <h3 
                          className="font-semibold truncate" 
                          style={{ color: 'var(--terminal-text)' }}
                          title={document.originalName}
                          data-testid={`text-document-name-${document.id}`}
                        >
                          {document.originalName}
                        </h3>
                      )}
                    </div>

                    <div className="flex items-center space-x-4 text-xs mb-2" style={{ color: 'var(--terminal-text)', opacity: 0.6 }}>
                      <span className="flex items-center">
                        <HardDrive size={12} className="mr-1" />
                        {formatFileSize(document.fileSize)}
                      </span>
                      <span className="flex items-center">
                        <Calendar size={12} className="mr-1" />
                        {formatDate(document.uploadedAt)}
                      </span>
                      <Badge variant="outline" className="text-xs px-1 py-0">
                        {document.mimeType}
                      </Badge>
                    </div>

                    {document.summary && (
                      <p className="text-sm mb-2 line-clamp-2" style={{ color: 'var(--terminal-text)', opacity: 0.8 }}>
                        {document.summary}
                      </p>
                    )}

                    {document.keywords && document.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {document.keywords.slice(0, 5).map((keyword) => (
                          <Badge
                            key={keyword}
                            variant="secondary"
                            className="text-xs px-2 py-0 border"
                            style={{
                              backgroundColor: 'var(--terminal-highlight)',
                              color: 'var(--terminal-text)',
                              borderColor: 'rgba(var(--terminal-subtle-rgb), 0.3)'
                            }}
                          >
                            {keyword}
                          </Badge>
                        ))}
                        {document.keywords.length > 5 && (
                          <Badge 
                            variant="secondary" 
                            className="text-xs px-2 py-0"
                            style={{
                              backgroundColor: 'var(--terminal-bg)',
                              color: 'var(--terminal-text)',
                              opacity: 0.6
                            }}
                          >
                            +{document.keywords.length - 5} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 ml-4 flex-shrink-0">
                    <Button
                      onClick={() => handleRenameStart(document.id, document.originalName)}
                      variant="ghost"
                      size="sm"
                      className="hover:bg-terminal-highlight/20 p-1 h-8 w-8"
                      style={{ color: 'var(--terminal-text)' }}
                      disabled={renamingId !== null || deleteMutation.isPending}
                      data-testid={`button-rename-${document.id}`}
                    >
                      <Edit2 size={14} />
                    </Button>
                    <Button
                      onClick={() => handleDelete(document.id, document.originalName)}
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300 hover:bg-red-900/20 p-1 h-8 w-8"
                      disabled={deleteMutation.isPending || renamingId !== null}
                      data-testid={`button-delete-${document.id}`}
                    >
                      <Trash2 size={14} />
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
        <div className="mt-4 pt-4 border-t" style={{ borderColor: 'rgba(var(--terminal-subtle-rgb), 0.3)' }}>
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