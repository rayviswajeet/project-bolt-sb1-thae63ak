import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Send, User } from 'lucide-react';
import { Separator } from "@/components/ui/separator";

interface Remark {
  id: string;
  text: string;
  author: string;
  timestamp: Date;
  response?: {
    text: string;
    author: string;
    timestamp: Date;
  };
}

interface RemarksModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  taskName: string;
  initialRemarks?: Remark[];
  onSave: (remarks: Remark[]) => void;
}

export default function RemarksModal({
  isOpen,
  onClose,
  taskId,
  taskName,
  initialRemarks = [],
  onSave
}: RemarksModalProps) {
  const [remarks, setRemarks] = useState<Remark[]>(initialRemarks);
  const [newRemark, setNewRemark] = useState('');
  const [newRemarkAuthor, setNewRemarkAuthor] = useState('');
  const [responses, setResponses] = useState<{ [key: string]: string }>({});
  const [responseAuthors, setResponseAuthors] = useState<{ [key: string]: string }>({});
  const { toast } = useToast();

  const pendingResponsesCount = remarks.filter(r => !r.response).length;

  const handleAddRemark = () => {
    if (!newRemark.trim() || !newRemarkAuthor.trim()) {
      toast({
        title: "Validation Error",
        description: "Both remark text and author name are required",
        variant: "destructive"
      });
      return;
    }

    const remark: Remark = {
      id: crypto.randomUUID(),
      text: newRemark.trim(),
      author: newRemarkAuthor.trim(),
      timestamp: new Date()
    };

    setRemarks([...remarks, remark]);
    setNewRemark('');
    setNewRemarkAuthor('');
  };

  const handleAddResponse = (remarkId: string) => {
    const responseText = responses[remarkId]?.trim();
    const responseAuthor = responseAuthors[remarkId]?.trim();

    if (!responseText || !responseAuthor) {
      toast({
        title: "Validation Error",
        description: "Both response text and PM name are required",
        variant: "destructive"
      });
      return;
    }

    setRemarks(remarks.map(remark => {
      if (remark.id === remarkId) {
        return {
          ...remark,
          response: {
            text: responseText,
            author: responseAuthor,
            timestamp: new Date()
          }
        };
      }
      return remark;
    }));

    setResponses(prev => ({ ...prev, [remarkId]: '' }));
    setResponseAuthors(prev => ({ ...prev, [remarkId]: '' }));
  };

  const handleSave = () => {
    onSave(remarks);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-2 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="w-4 h-4" />
            Remarks for Task: {taskName}
          </DialogTitle>
          {pendingResponsesCount > 0 && (
            <p className="text-xs text-red-500">
              {pendingResponsesCount} remark{pendingResponsesCount > 1 ? 's' : ''} pending PM response
            </p>
          )}
        </DialogHeader>
        
        <div className="flex-1 overflow-auto pr-2">
          {/* Add new remark section */}
          <div className="bg-gray-50 p-2 rounded-lg mb-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2 bg-white p-1 rounded border">
                <User className="w-3.5 h-3.5 text-gray-500" />
                <Input
                  placeholder="Enter your name"
                  value={newRemarkAuthor}
                  onChange={(e) => setNewRemarkAuthor(e.target.value)}
                  className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-7 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Textarea
                  placeholder="Enter your remark"
                  value={newRemark}
                  onChange={(e) => setNewRemark(e.target.value)}
                  className="min-h-[32px] h-[32px] resize-none text-sm flex-1"
                />
                <Button onClick={handleAddRemark} className="h-8 px-3 text-sm shrink-0">
                  Add
                </Button>
              </div>
            </div>
          </div>

          {/* Remarks list */}
          <div className="space-y-2">
            {remarks.map((remark) => (
              <div key={remark.id} className="p-2 border rounded-lg bg-white shadow-sm">
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3 h-3 text-gray-500" />
                      <span className="font-medium">{remark.author}</span>
                    </div>
                    <span className="text-gray-500">{format(remark.timestamp, 'PPpp')}</span>
                  </div>
                  <p className="text-xs bg-gray-50 p-1.5 rounded">{remark.text}</p>
                </div>

                {!remark.response ? (
                  <div className="mt-1.5 pt-1.5 border-t">
                    <div className="flex gap-2">
                      <div className="flex items-center gap-1.5 bg-gray-50 px-1.5 py-1 rounded border flex-1">
                        <User className="w-3 h-3 text-gray-500" />
                        <Input
                          placeholder="PM name"
                          value={responseAuthors[remark.id] || ''}
                          onChange={(e) => setResponseAuthors(prev => ({ ...prev, [remark.id]: e.target.value }))}
                          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-6 text-xs"
                        />
                      </div>
                      <Button 
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => handleAddResponse(remark.id)}
                      >
                        Reply
                      </Button>
                    </div>
                    <Textarea
                      placeholder="Enter PM response"
                      value={responses[remark.id] || ''}
                      onChange={(e) => setResponses(prev => ({ ...prev, [remark.id]: e.target.value }))}
                      className="mt-1.5 min-h-[32px] h-[32px] resize-none text-sm w-full"
                    />
                  </div>
                ) : (
                  <div className="mt-1.5 pt-1.5 border-t">
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3 h-3 text-blue-500" />
                        <span className="font-medium text-blue-500">Response by: {remark.response.author}</span>
                      </div>
                      <span className="text-gray-500">{format(remark.response.timestamp, 'PPpp')}</span>
                    </div>
                    <p className="text-xs bg-blue-50 p-1.5 rounded mt-1">{remark.response.text}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 mt-2 border-t flex-shrink-0">
          <Button variant="outline" onClick={onClose} className="h-7 text-sm">Cancel</Button>
          <Button onClick={handleSave} className="h-7 text-sm">Save Changes</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 