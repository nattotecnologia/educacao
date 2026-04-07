import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const leadId = searchParams.get('leadId');

  if (!leadId) {
    return NextResponse.json({ error: 'leadId required' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let lastMessageCount = 0;

      const sendEvent = (data: string) => {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      const checkForNewMessages = async () => {
        try {
          const { data: messages, count } = await supabase
            .from('messages')
            .select('*', { count: 'exact' })
            .eq('lead_id', leadId)
            .order('created_at', { ascending: true });

          if (messages && messages.length > lastMessageCount) {
            const newMessages = messages.slice(lastMessageCount);
            sendEvent(JSON.stringify({ type: 'messages', data: newMessages }));
            lastMessageCount = messages.length;
          }

          const { data: lead } = await supabase
            .from('leads')
            .select('status')
            .eq('id', leadId)
            .single();

          if (lead) {
            sendEvent(JSON.stringify({ type: 'status', data: lead }));
          }
        } catch (error) {
          console.error('Erro no SSE:', error);
        }
      };

      const intervalId = setInterval(checkForNewMessages, 2000);

      request.signal.addEventListener('abort', () => {
        clearInterval(intervalId);
        controller.close();
      });

      await checkForNewMessages();
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
