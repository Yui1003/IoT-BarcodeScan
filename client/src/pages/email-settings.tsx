import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Mail, Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout";

export default function EmailSettings() {
  const { toast } = useToast();
  const [newEmail, setNewEmail] = useState("");

  const { data: emails = [], isLoading } = useQuery<string[]>({
    queryKey: ["/api/email-settings"],
  });

  const mutation = useMutation({
    mutationFn: async (updatedEmails: string[]) => {
      const res = await apiRequest("PUT", "/api/email-settings", updatedEmails);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-settings"] });
      toast({
        title: "Success",
        description: "Email settings updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAddEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;
    
    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    if (emails.includes(newEmail)) {
      toast({
        title: "Duplicate Email",
        description: "This email is already in the list.",
        variant: "destructive",
      });
      return;
    }

    mutation.mutate([...emails, newEmail]);
    setNewEmail("");
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    mutation.mutate(emails.filter(e => e !== emailToRemove));
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Email Notifications</h1>
          <p className="text-muted-foreground">
            Configure email addresses that will receive alerts when items are low on stock or out of stock.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-6 h-6" />
              Recipient Settings
            </CardTitle>
            <CardDescription>
              Alerts will be sent via Resend API to the addresses listed below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddEmail} className="flex gap-2 mb-6">
              <Input
                placeholder="Enter email address"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="flex-1"
                data-testid="input-email"
              />
              <Button type="submit" disabled={mutation.isPending} data-testid="button-add-email">
                {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Add Email
              </Button>
            </form>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Notification Recipients</h3>
              {isLoading ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : emails.length === 0 ? (
                <p className="text-sm text-center py-4 text-muted-foreground bg-muted/50 rounded-md border border-dashed">
                  No email addresses added yet.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {emails.map((email) => (
                    <Badge 
                      key={email} 
                      variant="secondary" 
                      className="pl-3 pr-1 py-1 flex items-center gap-1 text-sm h-auto"
                      data-testid={`badge-email-${email}`}
                    >
                      {email}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 rounded-full hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => handleRemoveEmail(email)}
                        data-testid={`button-remove-email-${email}`}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
