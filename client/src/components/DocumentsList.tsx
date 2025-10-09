import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  File, 
  Trash2, 
  Download, 
  Search, 
  Calendar, 
  FileText,
  HardDrive
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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query for user documents
  const { data: documents = [], isLoading, error } = useQuery<Document[]>({
    queryKey: ['/api/documents'],
    retry: 1,
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

  const filteredDocuments = documents.filter(doc =>
    doc.originalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.keywords?.some(keyword => keyword.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (error) {
    return (
      <div className="bg-[#0D1117] border border-red-500/20 rounded-lg p-6 max-w-4xl w-full max-h-[90vh]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-red-400 font-mono flex items-center">
            <FileText className="mr-2" size={20} />
            Knowledge Base Documents
          </h2>
          {onClose && (
            <Button onClick={onClose} variant="ghost" size="sm" className="text-[#00FF41]">
              ✕
            </Button>
          )}
        </div>
        <div className="text-red-400 p-4 text-center">
          <p>Error loading documents: {(error as Error).message}</p>
          <p className="text-sm text-gray-400 mt-2">
            You may need to log in again to access your documents.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0D1117] border border-[#00FF41]/20 rounded-lg p-6 max-w-4xl w-full max-h-[90vh]">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-[#00FF41] font-mono flex items-center">
          <FileText className="mr-2" size={20} />
          Knowledge Base Documents
        </h2>
        {onClose && (
          <Button onClick={onClose} variant="ghost" size="sm" className="text-[#00FF41]">
            ✕
          </Button>
        )}
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search documents by name, content, or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            className="w-full pl-10 pr-4 py-2 bg-black border border-[#00FF41]/20 text-[#00FF41] rounded-md focus:outline-none focus:border-[#00FF41] font-mono text-sm"
            data-testid="input-document-search"
          />
        </div>
      </div>

      {/* Documents Count */}
      <div className="mb-4 text-sm text-gray-400">
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
          <div className="text-center text-gray-400 py-8">
            <HardDrive className="mx-auto mb-2" size={24} />
            Loading your documents...
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
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
                className="border border-[#00FF41]/20 rounded-lg p-4 hover:border-[#00FF41]/40 transition-colors bg-black/50"
                data-testid={`document-item-${document.id}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      <File className="text-[#00FF41] flex-shrink-0" size={16} />
                      <h3 
                        className="text-[#00FF41] font-semibold truncate" 
                        title={document.originalName}
                        data-testid={`text-document-name-${document.id}`}
                      >
                        {document.originalName}
                      </h3>
                    </div>

                    <div className="flex items-center space-x-4 text-xs text-gray-400 mb-2">
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
                      <p className="text-sm text-gray-300 mb-2 line-clamp-2">
                        {document.summary}
                      </p>
                    )}

                    {document.keywords && document.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {document.keywords.slice(0, 5).map((keyword) => (
                          <Badge
                            key={keyword}
                            variant="secondary"
                            className="text-xs px-2 py-0 bg-[#00FF41]/10 text-[#00FF41] border-[#00FF41]/20"
                          >
                            {keyword}
                          </Badge>
                        ))}
                        {document.keywords.length > 5 && (
                          <Badge variant="secondary" className="text-xs px-2 py-0 bg-gray-800 text-gray-400">
                            +{document.keywords.length - 5} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 ml-4 flex-shrink-0">
                    <Button
                      onClick={() => handleDelete(document.id, document.originalName)}
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300 hover:bg-red-900/20 p-1 h-8 w-8"
                      disabled={deleteMutation.isPending}
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
        <div className="mt-4 pt-4 border-t border-[#00FF41]/20">
          <div className="text-xs text-gray-400 flex justify-between">
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