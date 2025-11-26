import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Settings, LogOut, Brain, Volume2 } from "lucide-react";

interface UserProfileProps {
  onClose: () => void;
}

export function UserProfile({ onClose }: UserProfileProps) {
  const { user, isAuthenticated } = useAuth();
  const { preferences, updatePreferences, isUpdating } = useUserPreferences();
  const [activeTab, setActiveTab] = useState<"profile" | "preferences">("profile");

  if (!isAuthenticated || !user) {
    return (
      <Card style={{ 
        backgroundColor: 'var(--terminal-bg)', 
        borderColor: 'rgba(var(--terminal-subtle-rgb), 0.3)',
        color: 'var(--terminal-text)'
      }}>
        <CardHeader>
          <CardTitle style={{ color: 'var(--terminal-text)' }}>Authentication Required</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>Please log in to access your profile.</p>
          <Button 
            onClick={() => window.location.href = '/api/login'}
            style={{ backgroundColor: 'var(--terminal-highlight)', color: 'var(--terminal-bg)' }}
          >
            Log In
          </Button>
          <Button 
            onClick={onClose}
            variant="outline"
            style={{ borderColor: 'rgba(var(--terminal-subtle-rgb), 0.3)', color: 'var(--terminal-text)' }}
          >
            Cancel
          </Button>
        </CardContent>
      </Card>
    );
  }

  const handlePreferenceUpdate = async (updates: any) => {
    try {
      await updatePreferences(updates);
    } catch (error) {
      console.error("Failed to update preferences:", error);
    }
  };

  return (
    <Card className="max-w-2xl w-full" style={{ 
      backgroundColor: 'var(--terminal-bg)', 
      borderColor: 'rgba(var(--terminal-subtle-rgb), 0.5)',
      color: 'var(--terminal-text)'
    }}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2" style={{ color: 'var(--terminal-text)' }}>
            <User size={20} />
            ARCHIMEDES User Profile
          </CardTitle>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            style={{ color: 'var(--terminal-text)' }}
          >
            ✕
          </Button>
        </div>
        <div className="flex gap-2 mt-4">
          <Button
            onClick={() => setActiveTab("profile")}
            variant={activeTab === "profile" ? "default" : "outline"}
            size="sm"
            style={activeTab === "profile" 
              ? { backgroundColor: 'var(--terminal-highlight)', color: 'var(--terminal-bg)' }
              : { borderColor: 'rgba(var(--terminal-subtle-rgb), 0.3)', color: 'var(--terminal-text)', backgroundColor: '#2b2c37' }
            }
          >
            Profile
          </Button>
          <Button
            onClick={() => setActiveTab("preferences")}
            variant={activeTab === "preferences" ? "default" : "outline"}
            size="sm"
            style={activeTab === "preferences" 
              ? { backgroundColor: 'var(--terminal-highlight)', color: 'var(--terminal-bg)' }
              : { borderColor: 'rgba(var(--terminal-subtle-rgb), 0.3)', color: 'var(--terminal-text)' }
            }
          >
            <Settings size={16} />
            Preferences
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {activeTab === "profile" && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {user.profileImageUrl && (
                <img
                  src={user.profileImageUrl}
                  alt="Profile"
                  className="w-16 h-16 rounded-full border-2"
                  style={{ borderColor: 'rgba(var(--terminal-subtle-rgb), 0.5)' }}
                />
              )}
              <div>
                <h3 className="text-xl font-mono" style={{ color: 'var(--terminal-text)' }}>
                  {user.firstName && user.lastName 
                    ? `${user.firstName} ${user.lastName}`
                    : user.email
                  }
                </h3>
                <p style={{ color: 'var(--terminal-text)', opacity: 0.8 }}>{user.email}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm" style={{ color: 'var(--terminal-text)', opacity: 0.8 }}>Status</p>
                <Badge style={{ backgroundColor: '#2b2c37', color: 'var(--terminal-bg)' }}>Active</Badge>
              </div>
              <div>
                <p className="text-sm" style={{ color: 'var(--terminal-text)', opacity: 0.8 }}>Member Since</p>
                <p className="font-mono text-sm">
                  {new Date(user.createdAt!).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "preferences" && preferences && (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2" style={{ color: 'var(--terminal-text)' }}>
                <Brain size={16} />
                <h4 className="font-semibold">AI Behavior</h4>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Button
                  onClick={() => handlePreferenceUpdate({ defaultMode: "natural" })}
                  variant={preferences.defaultMode === "natural" ? "default" : "outline"}
                  style={preferences.defaultMode === "natural"
                    ? { backgroundColor: 'var(--terminal-highlight)', color: 'var(--terminal-bg)' }
                    : { borderColor: 'rgba(var(--terminal-subtle-rgb), 0.3)', color: 'var(--terminal-text)' }
                  }
                  disabled={isUpdating}
                >
                  Natural Chat
                </Button>
                <Button
                  onClick={() => handlePreferenceUpdate({ defaultMode: "technical" })}
                  variant={preferences.defaultMode === "technical" ? "default" : "outline"}
                  style={preferences.defaultMode === "technical"
                    ? { backgroundColor: 'var(--terminal-highlight)', color: 'var(--terminal-bg)' }
                    : { borderColor: 'rgba(var(--terminal-subtle-rgb), 0.3)', color: 'var(--terminal-text)' }
                  }
                  disabled={isUpdating}
                >
                  Technical Mode
                </Button>
                <Button
                  onClick={() => handlePreferenceUpdate({ defaultMode: "health" })}
                  variant={preferences.defaultMode === "health" ? "default" : "outline"}
                  style={preferences.defaultMode === "health"
                    ? { backgroundColor: 'var(--terminal-highlight)', color: 'var(--terminal-bg)' }
                    : { borderColor: 'rgba(var(--terminal-subtle-rgb), 0.3)', color: 'var(--terminal-text)' }
                  }
                  disabled={isUpdating}
                >
                  Health Mode
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2" style={{ color: 'var(--terminal-text)' }}>
                <Volume2 size={16} />
                <h4 className="font-semibold">Voice Settings</h4>
              </div>
              <div className="space-y-2">
                <Button
                  onClick={() => handlePreferenceUpdate({ voiceEnabled: !preferences.voiceEnabled })}
                  variant={preferences.voiceEnabled ? "default" : "outline"}
                  style={preferences.voiceEnabled
                    ? { backgroundColor: 'var(--terminal-highlight)', color: 'var(--terminal-bg)' }
                    : { borderColor: 'rgba(var(--terminal-subtle-rgb), 0.3)', color: 'var(--terminal-text)' }
                  }
                  disabled={isUpdating}
                >
                  {preferences.voiceEnabled ? "Voice On" : "Voice Off"}
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="pt-4 border-t" style={{ borderColor: 'rgba(var(--terminal-subtle-rgb), 0.2)' }}>
          <Button
            onClick={() => window.location.href = '/api/logout'}
            variant="outline"
            className="w-full"
            style={{ borderColor: 'rgba(255, 77, 77, 0.3)', color: '#ff4d4d' }}
          >
            <LogOut size={16} className="mr-2" />
            Log Out
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}