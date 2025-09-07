import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Settings, LogOut, Brain, Volume2, Palette } from "lucide-react";

interface UserProfileProps {
  onClose: () => void;
}

export function UserProfile({ onClose }: UserProfileProps) {
  const { user, isAuthenticated } = useAuth();
  const { preferences, updatePreferences, isUpdating } = useUserPreferences();
  const [activeTab, setActiveTab] = useState<"profile" | "preferences">("profile");

  if (!isAuthenticated || !user) {
    return (
      <Card className="bg-black/90 border-green-400/30 text-green-400">
        <CardHeader>
          <CardTitle className="text-green-400">Authentication Required</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>Please log in to access your profile.</p>
          <Button 
            onClick={() => window.location.href = '/api/login'}
            className="bg-green-500 text-black hover:bg-green-400"
          >
            Log In
          </Button>
          <Button 
            onClick={onClose}
            variant="outline"
            className="border-green-400/30 text-green-400 hover:bg-green-400/10"
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
    <Card className="bg-black/95 border-green-400/50 text-green-400 max-w-2xl w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <User size={20} />
            ARCHIMEDES User Profile
          </CardTitle>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="text-green-400 hover:text-green-300"
          >
            ✕
          </Button>
        </div>
        <div className="flex gap-2 mt-4">
          <Button
            onClick={() => setActiveTab("profile")}
            variant={activeTab === "profile" ? "default" : "outline"}
            size="sm"
            className={activeTab === "profile" 
              ? "bg-green-500 text-black" 
              : "border-green-400/30 text-green-400 hover:bg-green-400/10"
            }
          >
            Profile
          </Button>
          <Button
            onClick={() => setActiveTab("preferences")}
            variant={activeTab === "preferences" ? "default" : "outline"}
            size="sm"
            className={activeTab === "preferences" 
              ? "bg-green-500 text-black" 
              : "border-green-400/30 text-green-400 hover:bg-green-400/10"
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
                  className="w-16 h-16 rounded-full border-2 border-green-400/50"
                />
              )}
              <div>
                <h3 className="text-xl font-mono">
                  {user.firstName && user.lastName 
                    ? `${user.firstName} ${user.lastName}`
                    : user.email
                  }
                </h3>
                <p className="text-green-300">{user.email}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-green-300">Status</p>
                <Badge className="bg-green-500 text-black">Active</Badge>
              </div>
              <div>
                <p className="text-sm text-green-300">Member Since</p>
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
              <div className="flex items-center gap-2">
                <Brain size={16} />
                <h4 className="font-semibold">AI Behavior</h4>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Button
                  onClick={() => handlePreferenceUpdate({ defaultMode: "natural" })}
                  variant={preferences.defaultMode === "natural" ? "default" : "outline"}
                  className={preferences.defaultMode === "natural"
                    ? "bg-green-500 text-black"
                    : "border-green-400/30 text-green-400 hover:bg-green-400/10"
                  }
                  disabled={isUpdating}
                >
                  Natural Chat
                </Button>
                <Button
                  onClick={() => handlePreferenceUpdate({ defaultMode: "technical" })}
                  variant={preferences.defaultMode === "technical" ? "default" : "outline"}
                  className={preferences.defaultMode === "technical"
                    ? "bg-green-500 text-black"
                    : "border-green-400/30 text-green-400 hover:bg-green-400/10"
                  }
                  disabled={isUpdating}
                >
                  Technical Mode
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Volume2 size={16} />
                <h4 className="font-semibold">Voice Settings</h4>
              </div>
              <div className="space-y-2">
                <Button
                  onClick={() => handlePreferenceUpdate({ voiceEnabled: !preferences.voiceEnabled })}
                  variant={preferences.voiceEnabled ? "default" : "outline"}
                  className={preferences.voiceEnabled
                    ? "bg-green-500 text-black"
                    : "border-green-400/30 text-green-400 hover:bg-green-400/10"
                  }
                  disabled={isUpdating}
                >
                  {preferences.voiceEnabled ? "Voice On" : "Voice Off"}
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Palette size={16} />
                <h4 className="font-semibold">Terminal Theme</h4>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {["classic", "neon", "minimal"].map((theme) => (
                  <Button
                    key={theme}
                    onClick={() => handlePreferenceUpdate({ terminalTheme: theme })}
                    variant={preferences.terminalTheme === theme ? "default" : "outline"}
                    size="sm"
                    className={preferences.terminalTheme === theme
                      ? "bg-green-500 text-black"
                      : "border-green-400/30 text-green-400 hover:bg-green-400/10"
                    }
                    disabled={isUpdating}
                  >
                    {theme.charAt(0).toUpperCase() + theme.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-green-400/20">
          <Button
            onClick={() => window.location.href = '/api/logout'}
            variant="outline"
            className="w-full border-red-400/30 text-red-400 hover:bg-red-400/10"
          >
            <LogOut size={16} className="mr-2" />
            Log Out
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}