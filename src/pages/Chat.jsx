import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';
import { ArrowLeft, CheckCheck, FileText, MessageCircleMore, Paperclip, Search, Send, X } from 'lucide-react';
import { format, isSameDay, isToday, isYesterday } from 'date-fns';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useDocViewer } from '../components/DocViewer';

const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const isImageAttachment = (url = '') => /\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i.test(url);
const sameId = (left, right) => String(left) === String(right);
const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';

function formatConversationTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return isToday(date) ? format(date, 'p') : isYesterday(date) ? 'Yesterday' : format(date, 'dd MMM');
}

function formatMessageDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'dd MMMM yyyy');
}

function Avatar({ name, photo, size = 'md', online = false }) {
  const dimensions = size === 'lg' ? 'h-11 w-11 text-sm' : size === 'sm' ? 'h-8 w-8 text-[10px]' : 'h-10 w-10 text-xs';
  return (
    <span className={`relative flex shrink-0 ${dimensions} items-center justify-center overflow-visible rounded-full bg-linear-to-br from-emerald-100 to-cyan-100 font-bold text-emerald-700`}>
      <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full">
        {photo ? <img src={photo} alt={name || 'User'} className="h-full w-full object-cover" /> : initials(name)}
      </span>
      {online && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" aria-label="Online" />}
    </span>
  );
}

function ConversationRow({ conversation, active, online, onClick }) {
  const unread = Number(conversation.unread_count) || 0;
  return (
    <button type="button" onClick={onClick} className={`group flex w-full items-center gap-3 border-b border-slate-100 px-3 py-3 text-left transition-colors duration-150 ${active ? 'bg-emerald-50/80' : 'hover:bg-slate-50'}`}>
      <Avatar name={conversation.user_name} photo={conversation.user_photo} online={online} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-3"><span className={`truncate text-sm ${unread ? 'font-bold text-slate-950' : 'font-semibold text-slate-700'}`}>{conversation.user_name}</span><span className={`shrink-0 text-[10px] ${unread ? 'font-semibold text-emerald-600' : 'text-slate-400'}`}>{formatConversationTime(conversation.last_message_time || conversation.conversation_created_at)}</span></span>
        <span className="mt-1 flex items-center justify-between gap-2"><span className={`truncate text-xs ${unread ? 'font-medium text-slate-600' : 'text-slate-400'}`}>{conversation.last_message || 'Start a conversation'}</span>{unread > 0 && <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white">{unread > 99 ? '99+' : unread}</span>}</span>
      </span>
    </button>
  );
}

function UserRow({ member, online, onClick }) {
  return (
    <button type="button" onClick={onClick} className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-150 hover:bg-emerald-50/70">
      <Avatar name={member.name} photo={member.photo} online={online} />
      <span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-700 group-hover:text-emerald-800">{member.name}</span><span className="mt-0.5 block truncate text-[11px] text-slate-400">{member.role || 'Team member'}</span></span>
    </button>
  );
}

export default function Chat() {
  const { user, token } = useAuth();
  const { id: urlConversationId } = useParams();
  const navigate = useNavigate();
  const openDoc = useDocViewer();
  const [users, setUsers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [messageLoading, setMessageLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState(() => new Set());
  const [typingUserId, setTypingUserId] = useState(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const socketRef = useRef(null);
  const activeConversationRef = useRef(null);
  const userRef = useRef(user);
  const messageRequestRef = useRef(0);
  const lastActiveConversationRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const scrollFrameRef = useRef(null);

  useEffect(() => { activeConversationRef.current = activeConversation; }, [activeConversation]);
  useEffect(() => { userRef.current = user; }, [user]);

  const refreshConversations = useCallback(async () => {
    const response = await api.get('/chat/conversations');
    setConversations(response.data?.conversations || []);
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadChat = async () => {
      setLoading(true);
      try {
        const [usersResponse, conversationsResponse] = await Promise.all([api.get('/chat/users'), api.get('/chat/conversations')]);
        if (!mounted) return;
        setUsers(usersResponse.data?.users || []);
        setConversations(conversationsResponse.data?.conversations || []);
      } catch {
        if (mounted) toast.error('Could not load internal chat. Please refresh and try again.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadChat();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    const chatSocket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
    });
    socketRef.current = chatSocket;

    const onNewMessage = (message) => {
      const currentConversation = activeConversationRef.current;
      const currentUser = userRef.current;
      const isOpen = currentConversation && sameId(message.conversation_id, currentConversation.id);

      if (isOpen) {
        setMessages((previous) => previous.some((item) => sameId(item.id, message.id)) ? previous : [...previous, message]);
      }

      setConversations((previous) => {
        const existing = previous.find((item) => sameId(item.conversation_id, message.conversation_id));
        if (!existing) {
          void refreshConversations().catch(() => undefined);
          return previous;
        }
        const next = previous.map((item) => sameId(item.conversation_id, message.conversation_id) ? {
          ...item,
          last_message: message.message_text || (message.attachment_url ? 'Attachment' : ''),
          last_message_time: message.created_at,
          unread_count: !sameId(message.sender_id, currentUser?.id) && !isOpen ? Number(item.unread_count || 0) + 1 : item.unread_count,
        } : item);
        return next.sort((left, right) => new Date(right.last_message_time || right.conversation_created_at) - new Date(left.last_message_time || left.conversation_created_at));
      });
    };

    const onUserOnline = ({ userId }) => setOnlineUserIds((previous) => new Set([...previous, String(userId)]));
    const onUserOffline = ({ userId }) => setOnlineUserIds((previous) => {
      const next = new Set(previous);
      next.delete(String(userId));
      return next;
    });
    const onTyping = ({ conversationId, userId, isTyping }) => {
      const currentConversation = activeConversationRef.current;
      if (currentConversation && sameId(conversationId, currentConversation.id) && !sameId(userId, userRef.current?.id)) setTypingUserId(isTyping ? String(userId) : null);
    };

    chatSocket.on('new_message', onNewMessage);
    chatSocket.on('user_online', onUserOnline);
    chatSocket.on('user_offline', onUserOffline);
    chatSocket.on('typing', onTyping);
    chatSocket.on('connect_error', () => toast.error('Live chat is reconnecting. Messages will continue once connected.'));

    return () => {
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
      chatSocket.off('new_message', onNewMessage);
      chatSocket.off('user_online', onUserOnline);
      chatSocket.off('user_offline', onUserOffline);
      chatSocket.off('typing', onTyping);
      chatSocket.disconnect();
      if (socketRef.current === chatSocket) socketRef.current = null;
    };
  }, [refreshConversations, token]);

  useEffect(() => {
    const chatSocket = socketRef.current;
    if (!chatSocket || !activeConversation?.id) return undefined;
    chatSocket.emit('join_conversation', activeConversation.id);
    return () => {
      chatSocket.emit('typing', { conversationId: activeConversation.id, isTyping: false });
      chatSocket.emit('leave_conversation', activeConversation.id);
    };
  }, [activeConversation?.id]);

  useEffect(() => {
    if (!urlConversationId) {
      setActiveConversation(null);
      return;
    }
    const conversation = conversations.find((item) => sameId(item.conversation_id, urlConversationId));
    if (conversation) {
      setActiveConversation((previous) => sameId(previous?.id, conversation.conversation_id) ? previous : {
        id: conversation.conversation_id,
        user_id: conversation.user_id,
        user_name: conversation.user_name,
        user_photo: conversation.user_photo,
      });
    }
  }, [conversations, urlConversationId]);

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    if (scrollFrameRef.current) window.cancelAnimationFrame(scrollFrameRef.current);
    scrollFrameRef.current = window.requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' }));
  }, []);

  useEffect(() => () => { if (scrollFrameRef.current) window.cancelAnimationFrame(scrollFrameRef.current); }, []);

  useEffect(() => {
    if (!activeConversation?.id) {
      setMessages([]);
      setMessageLoading(false);
      return undefined;
    }
    const requestId = messageRequestRef.current + 1;
    messageRequestRef.current = requestId;
    const conversationId = activeConversation.id;
    setMessages([]);
    setMessageLoading(true);
    setTypingUserId(null);

    const loadMessages = async () => {
      try {
        const response = await api.get(`/chat/messages/${conversationId}`);
        if (messageRequestRef.current !== requestId) return;
        setMessages(response.data?.messages || []);
        setConversations((previous) => previous.map((item) => sameId(item.conversation_id, conversationId) ? { ...item, unread_count: 0 } : item));
      } catch {
        if (messageRequestRef.current === requestId) toast.error('Could not load this conversation. Please try again.');
      } finally {
        if (messageRequestRef.current === requestId) setMessageLoading(false);
      }
    };
    loadMessages();
    return () => { if (messageRequestRef.current === requestId) messageRequestRef.current += 1; };
  }, [activeConversation?.id]);

  useEffect(() => {
    if (!activeConversation?.id || messageLoading) return;
    const isNewConversation = !sameId(lastActiveConversationRef.current, activeConversation.id);
    if (isNewConversation) {
      lastActiveConversationRef.current = activeConversation.id;
      scrollToBottom('auto');
      return;
    }
    const container = messagesContainerRef.current;
    if (container && container.scrollHeight - container.scrollTop - container.clientHeight < 300) scrollToBottom('smooth');
  }, [activeConversation?.id, messageLoading, messages.length, scrollToBottom]);

  const startChat = async (selectedUser) => {
    try {
      const response = await api.get(`/chat/conversations/${selectedUser.id}`);
      const conversation = response.data?.conversation;
      if (!conversation) throw new Error('Conversation was not created');
      const nextConversation = { id: conversation.id, user_id: selectedUser.id, user_name: selectedUser.name, user_photo: selectedUser.photo };
      setActiveConversation(nextConversation);
      setConversations((previous) => previous.some((item) => sameId(item.conversation_id, conversation.id)) ? previous : [{
        conversation_id: conversation.id,
        user_id: selectedUser.id,
        user_name: selectedUser.name,
        user_photo: selectedUser.photo,
        last_message: '',
        last_message_time: conversation.created_at || new Date().toISOString(),
        unread_count: 0,
      }, ...previous]);
      navigate(`/chat/${conversation.id}`);
    } catch {
      toast.error('Could not start this conversation. Please try again.');
    }
  };

  const stopTyping = useCallback(() => {
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    const conversationId = activeConversationRef.current?.id;
    if (conversationId) socketRef.current?.emit('typing', { conversationId, isTyping: false });
  }, []);

  const handleMessageInput = (event) => {
    const value = event.target.value;
    setMessageInput(value);
    const conversationId = activeConversation?.id;
    if (!conversationId || !socketRef.current?.connected) return;
    socketRef.current.emit('typing', { conversationId, isTyping: value.trim().length > 0 });
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(stopTyping, 1200);
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await api.post('/upload/single?provider=cloudinary', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const url = response.data?.fileUrl || response.data?.url;
      if (!url) throw new Error('Upload did not return a file URL');
      setAttachment({ url, name: file.name });
    } catch {
      toast.error('Attachment upload failed. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    const text = messageInput.trim();
    if ((!text && !attachment) || !activeConversation?.id || isSending) return;
    stopTyping();
    setIsSending(true);
    try {
      const response = await api.post('/chat/messages', { conversationId: activeConversation.id, text, attachmentUrl: attachment?.url || null });
      const message = response.data?.message;
      if (!message) throw new Error('Message was not returned');
      setMessages((previous) => previous.some((item) => sameId(item.id, message.id)) ? previous : [...previous, message]);
      setConversations((previous) => {
        const update = (item) => sameId(item.conversation_id, activeConversation.id) ? { ...item, last_message: message.message_text || (message.attachment_url ? 'Attachment' : ''), last_message_time: message.created_at } : item;
        const found = previous.some((item) => sameId(item.conversation_id, activeConversation.id));
        const next = found ? previous.map(update) : [{ conversation_id: activeConversation.id, user_id: activeConversation.user_id, user_name: activeConversation.user_name, user_photo: activeConversation.user_photo, last_message: message.message_text || 'Attachment', last_message_time: message.created_at, unread_count: 0 }, ...previous];
        return next.sort((left, right) => new Date(right.last_message_time || right.conversation_created_at) - new Date(left.last_message_time || left.conversation_created_at));
      });
      setMessageInput('');
      setAttachment(null);
      scrollToBottom('smooth');
    } catch {
      toast.error('Message could not be sent. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return query ? users.filter((member) => `${member.name || ''} ${member.role || ''}`.toLowerCase().includes(query)) : [];
  }, [searchQuery, users]);
  const isActiveUserOnline = activeConversation && onlineUserIds.has(String(activeConversation.user_id));

  return (
    <section className="flex h-[calc(100dvh-7rem)] min-h-[560px] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-xl shadow-slate-950/[0.05]">
      <aside className={`w-full shrink-0 flex-col border-r border-slate-200 bg-white lg:flex lg:w-[360px] lg:max-w-[38%] ${activeConversation ? 'hidden' : 'flex'}`}>
        <header className="border-b border-slate-200 bg-linear-to-br from-emerald-50 via-white to-cyan-50 px-4 pb-4 pt-5">
          <div className="flex items-center justify-between"><div><p className="text-base font-bold tracking-tight text-slate-950">Internal chat</p><p className="mt-0.5 text-[11px] text-slate-500">Team conversations, in real time</p></div><span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm ring-1 ring-emerald-100"><MessageCircleMore className="h-4 w-4" /></span></div>
          <div className="relative mt-4"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search people" className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" /></div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
          {loading ? <div className="space-y-3 p-4">{Array.from({ length: 6 }, (_, index) => <div key={index} className="flex items-center gap-3"><span className="h-10 w-10 animate-pulse rounded-full bg-slate-100" /><span className="flex-1 space-y-2"><span className="block h-3 w-2/5 animate-pulse rounded bg-slate-100" /><span className="block h-2.5 w-4/5 animate-pulse rounded bg-slate-100" /></span></div>)}</div> : searchQuery ? <div className="p-2"><p className="px-2 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">People</p>{filteredUsers.length ? filteredUsers.map((member) => <UserRow key={member.id} member={member} online={onlineUserIds.has(String(member.id))} onClick={() => startChat(member)} />) : <p className="px-3 py-8 text-center text-sm text-slate-400">No team member found.</p>}</div> : <><p className="px-4 pb-2 pt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Recent conversations</p>{conversations.length ? conversations.map((conversation) => <ConversationRow key={conversation.conversation_id} conversation={conversation} active={sameId(activeConversation?.id, conversation.conversation_id)} online={onlineUserIds.has(String(conversation.user_id))} onClick={() => navigate(`/chat/${conversation.conversation_id}`)} />) : <div className="px-6 py-14 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><MessageCircleMore className="h-5 w-5" /></span><p className="mt-4 text-sm font-semibold text-slate-700">No conversations yet</p><p className="mt-1 text-xs leading-5 text-slate-400">Use search to start a private conversation with a colleague.</p></div>}</>}</div>
      </aside>

      <main className={`min-w-0 flex-1 flex-col bg-[#efeae2] ${activeConversation ? 'flex' : 'hidden lg:flex'}`}>
        {activeConversation ? <>
          <header className="z-10 flex min-h-18 items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur sm:px-5">
            <div className="flex min-w-0 items-center gap-3"><button type="button" onClick={() => navigate('/chat')} className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 lg:hidden" aria-label="Back to conversations"><ArrowLeft className="h-5 w-5" /></button><Avatar name={activeConversation.user_name} photo={activeConversation.user_photo} size="lg" online={isActiveUserOnline} /><div className="min-w-0"><h1 className="truncate text-sm font-bold text-slate-900">{activeConversation.user_name}</h1><p className="mt-0.5 text-[11px] text-emerald-600">{typingUserId ? 'typing…' : isActiveUserOnline ? 'Online' : 'Internal team member'}</p></div></div>
            <span className="hidden rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-semibold text-emerald-700 sm:inline">Private conversation</span>
          </header>

          <div ref={messagesContainerRef} className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(rgba(15,118,110,.075)_1px,transparent_1px)] bg-size-[18px_18px] px-4 py-5 sm:px-6">
            {messageLoading ? <div className="flex h-full items-center justify-center"><div className="rounded-full bg-white px-4 py-2 text-xs font-medium text-slate-400 shadow-sm">Loading messages…</div></div> : messages.length ? <div className="mx-auto max-w-4xl space-y-2.5">{messages.map((message, index) => {
              const previous = messages[index - 1];
              const showDate = !previous || !isSameDay(new Date(message.created_at), new Date(previous.created_at));
              const isMe = sameId(message.sender_id, user?.id);
              return <div key={message.id}>{showDate && <div className="my-5 flex justify-center"><span className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-semibold text-slate-500 shadow-sm">{formatMessageDate(message.created_at)}</span></div>}<div className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>{!isMe && <Avatar name={message.sender_name} photo={message.sender_photo} size="sm" />}<article className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 shadow-sm sm:max-w-[68%] ${isMe ? 'rounded-br-md bg-emerald-600 text-white' : 'rounded-bl-md border border-white/80 bg-white text-slate-800'}`}><p className="whitespace-pre-wrap break-words text-sm leading-5">{message.message_text}</p>{message.attachment_url && (isImageAttachment(message.attachment_url) ? <img src={message.attachment_url} alt="Message attachment" className="mt-2 max-h-72 max-w-full rounded-xl border border-black/10 object-contain" /> : <button type="button" onClick={() => openDoc({ url: message.attachment_url, title: message.attachment_name || 'Attachment' })} className={`mt-2 flex max-w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition ${isMe ? 'bg-emerald-700/60 hover:bg-emerald-700/80' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}><FileText className="h-4 w-4 shrink-0" /><span className="truncate">View attachment</span></button>)}<footer className={`mt-1.5 flex items-center justify-end gap-1 text-[10px] ${isMe ? 'text-emerald-100' : 'text-slate-400'}`}><time>{format(new Date(message.created_at), 'p')}</time>{isMe && <CheckCheck className="h-3.5 w-3.5" aria-label={message.is_read ? 'Read' : 'Sent'} />}</footer></article></div></div>;
            })}<div ref={messagesEndRef} /></div> : <div className="flex h-full flex-col items-center justify-center text-center"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm"><MessageCircleMore className="h-6 w-6" /></span><p className="mt-4 text-sm font-semibold text-slate-700">Start the conversation</p><p className="mt-1 text-xs text-slate-500">Messages here are private to you and {activeConversation.user_name}.</p></div>}
          </div>

          <div className="border-t border-slate-200 bg-white p-3 sm:px-4">
            {attachment && <div className="mb-2 flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs"><span className="flex min-w-0 items-center gap-2 font-medium text-emerald-700"><Paperclip className="h-4 w-4 shrink-0" /><span className="truncate">{attachment.name}</span></span><button type="button" onClick={() => setAttachment(null)} className="rounded-full p-1 text-emerald-600 transition hover:bg-emerald-100" aria-label="Remove attachment"><X className="h-4 w-4" /></button></div>}
            <form onSubmit={sendMessage} className="flex items-center gap-2"><input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} /><button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading || isSending} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${uploading ? 'animate-pulse text-emerald-400' : 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'} disabled:cursor-not-allowed`} aria-label="Add attachment"><Paperclip className="h-5 w-5" /></button><input value={messageInput} onChange={handleMessageInput} disabled={isSending} placeholder="Type a message" className="h-11 min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100 disabled:opacity-60" /><button type="submit" disabled={(!messageInput.trim() && !attachment) || uploading || isSending} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm transition duration-150 hover:bg-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45" aria-label="Send message"><Send className="h-4 w-4" /></button></form>
          </div>
        </> : <div className="flex h-full flex-col items-center justify-center bg-linear-to-br from-white via-emerald-50/40 to-cyan-50/60 p-8 text-center"><span className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-white text-emerald-600 shadow-lg shadow-emerald-900/5 ring-1 ring-emerald-100"><MessageCircleMore className="h-9 w-9" /></span><h1 className="mt-6 text-xl font-bold tracking-tight text-slate-900">Your team, one message away</h1><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Choose a recent conversation on the left, or search for a colleague to start a new one.</p></div>}
      </main>
    </section>
  );
}
