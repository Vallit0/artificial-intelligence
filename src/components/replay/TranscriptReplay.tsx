import { useRef, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { TranscriptMessage } from '@/hooks/useSessionTranscript';

interface TranscriptReplayProps {
  messages: TranscriptMessage[];
  strengths?: string[];
  weaknesses?: string[];
}

function formatTimestamp(ts?: number) {
  if (!ts) return null;
  const date = new Date(ts);
  return date.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function hasGap(current?: number, previous?: number) {
  if (!current || !previous) return false;
  return (current - previous) > 30000; // 30 seconds
}

function matchesKeyMoment(content: string, keywords: string[]): string | null {
  const lower = content.toLowerCase();
  for (const keyword of keywords) {
    if (lower.includes(keyword.toLowerCase().substring(0, 20))) {
      return keyword;
    }
  }
  return null;
}

export function TranscriptReplay({ messages, strengths = [], weaknesses = [] }: TranscriptReplayProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (!messages || messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No hay transcript disponible para esta sesión
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px] pr-4" ref={scrollRef}>
      <div className="space-y-3 p-2">
        {messages.map((msg, i) => {
          const showGap = i > 0 && hasGap(msg.timestamp, messages[i - 1].timestamp);
          const strengthMatch = msg.role === 'user' ? matchesKeyMoment(msg.content, strengths) : null;
          const weaknessMatch = msg.role === 'user' ? matchesKeyMoment(msg.content, weaknesses) : null;

          return (
            <div key={i}>
              {showGap && (
                <div className="flex items-center gap-2 my-4">
                  <div className="flex-1 border-t border-dashed border-muted-foreground/30" />
                  <span className="text-xs text-muted-foreground">pausa</span>
                  <div className="flex-1 border-t border-dashed border-muted-foreground/30" />
                </div>
              )}

              <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] space-y-1`}>
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-sm ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-muted text-foreground rounded-bl-md'
                    }`}
                  >
                    {msg.content}
                  </div>

                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[10px] text-muted-foreground">
                      {msg.role === 'user' ? 'Asesor' : 'Cliente'}{' '}
                      {formatTimestamp(msg.timestamp) && `· ${formatTimestamp(msg.timestamp)}`}
                    </span>
                    {strengthMatch && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-500 text-green-600">
                        Fortaleza
                      </Badge>
                    )}
                    {weaknessMatch && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-500 text-red-600">
                        Debilidad
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
