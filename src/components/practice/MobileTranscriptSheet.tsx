import { MessageSquare } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import LiveTranscript from "@/components/LiveTranscript";

interface TranscriptMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface MobileTranscriptSheetProps {
  messages: TranscriptMessage[];
  partialTranscript?: string;
}

const MobileTranscriptSheet = ({ messages, partialTranscript }: MobileTranscriptSheetProps) => {
  // Combine committed messages with partial transcript
  const displayMessages = partialTranscript
    ? [
        ...messages,
        {
          id: "partial",
          text: partialTranscript,
          isUser: true,
          timestamp: new Date(),
        },
      ]
    : messages;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="fixed bottom-4 right-4 rounded-xl font-bold uppercase tracking-wider border-2 z-10 sm:hidden"
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          Chat
          {messages.length > 0 && (
            <span className="ml-2 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">
              {messages.length}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[60vh] rounded-t-2xl">
        <SheetHeader className="pb-2">
          <SheetTitle 
            className="flex items-center gap-2 font-bold uppercase tracking-wider text-sm"
            style={{ fontFamily: "'Nunito', 'DIN Rounded', -apple-system, sans-serif" }}
          >
            <MessageSquare className="h-4 w-4" />
            Transcripción en Vivo
          </SheetTitle>
        </SheetHeader>
        <div className="h-[calc(100%-3rem)] overflow-hidden">
          <LiveTranscript messages={displayMessages} />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MobileTranscriptSheet;
