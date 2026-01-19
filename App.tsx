import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, RotateCcw, Image as ImageIcon, Sparkles, Settings } from 'lucide-react';
import ChatMessage from './components/ChatMessage';
import ImageGallery from './components/ImageGallery';
import { AppState, Message, Sender, GeneratedImage, ThoughtStep } from './types';
import SettingsModal, { LOCAL_STORAGE_KEY } from './components/SettingsModal';
import { sendMessageToDoubao, generateImageWithDoubao } from './services/volcengine';
import { fetchExternalKnowledge, KnowledgeBaseResult } from './services/knowledgeBase';
import { SYSTEM_INSTRUCTION } from './constants';

const App: React.FC = () => {
    // Keys
    const SESSION_STORAGE_KEY = 'visual_bridge_session';

    // State with Lazy Initialization from LocalStorage
    const [messages, setMessages] = useState<Message[]>(() => {
        const saved = localStorage.getItem(SESSION_STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return parsed.messages || [];
            } catch (e) { console.error("Failed to load session", e); }
        }
        return [{
            id: 'welcome',
            sender: Sender.AI,
            text: "您好！我是 VisualBridge AI。\n\n为了帮您生成最准确的视觉素材，我会先询问您关于**场景、主体、风格和色调**的细节。\n\n请告诉我您的初步想法，例如：\n> “我需要一张科技感的大会海报，主体是一个发光的芯片。”",
            timestamp: Date.now()
        }];
    });

    const [images, setImages] = useState<GeneratedImage[]>(() => {
        const saved = localStorage.getItem(SESSION_STORAGE_KEY);
        return saved ? JSON.parse(saved).images || [] : [];
    });

    const [iterationCount, setIterationCount] = useState(() => {
        const saved = localStorage.getItem(SESSION_STORAGE_KEY);
        return saved ? JSON.parse(saved).iterationCount || 0 : 0;
    });

    const [input, setInput] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [currentPrompts, setCurrentPrompts] = useState<string[]>([]);
    const [currentAspectRatio, setCurrentAspectRatio] = useState<string>('1:1');

    const [showSettings, setShowSettings] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [systemContext, setSystemContext] = useState<string>('');
    const [kbMetadata, setKbMetadata] = useState<Omit<KnowledgeBaseResult, 'combined'> | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    // Ref to track session validity (solves race conditions on reset)
    const sessionIdRef = useRef<number>(Date.now());
    const MAX_ITERATIONS = 7;

    // Auto-scroll chat
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    // Persistence Effect: Save Session on Change
    useEffect(() => {
        const sessionData = {
            messages,
            images,
            iterationCount
        };
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
    }, [messages, images, iterationCount]);

    // Load Knowledge Base on mount
    useEffect(() => {
        const loadKnowledge = async () => {
            const kbResult = await fetchExternalKnowledge();
            if (kbResult.combined) {
                console.log("Knowledge Base loaded successfully");
                setSystemContext(kbResult.combined);
                setKbMetadata({ rolePrompt: kbResult.rolePrompt, doubaoKb: kbResult.doubaoKb });
            }
        };
        loadKnowledge();
    }, []);


    const handleSendMessage = async () => {
        if (!input.trim() || isTyping) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            sender: Sender.User,
            text: input,
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);

        // Prepare history for API
        const history = messages
            .filter(m => m.sender !== Sender.System)
            .map(m => ({
                role: m.sender === Sender.User ? 'user' : 'model',
                parts: [{ text: m.text }]
            }));

        // Call Volcengine Doubao for Text Analysis
        const fullSystemInstruction = systemContext
            ? `${SYSTEM_INSTRUCTION}\n\n### Additional Knowledge Base:\n${systemContext}`
            : undefined;

        console.log(`[DEBUG] systemContext length: ${systemContext ? systemContext.length : 0}`);
        if (!systemContext) console.warn("[DEBUG] systemContext is empty! Knowledge Base will NOT be used.");

        const currentSessionId = sessionIdRef.current;
        const response = await sendMessageToDoubao(history, userMsg.text, fullSystemInstruction);

        // Race Condition Check: If session reset during await, ignore result
        if (sessionIdRef.current !== currentSessionId) return;

        setIsTyping(false);

        // Build thoughts array from API response
        const thoughts: ThoughtStep[] = [];

        // Step 0: Knowledge Base loading status (from local tracking)
        if (kbMetadata) {
            const roleStatus = kbMetadata.rolePrompt.loaded ? '✓' : '✗';
            const doubaoStatus = kbMetadata.doubaoKb.loaded ? '✓' : '✗';
            thoughts.push({
                id: 'kb-load',
                icon: '📚',
                title: '知识库加载',
                content: `角色提示词 (${kbMetadata.rolePrompt.name}): ${roleStatus} ${kbMetadata.rolePrompt.chars > 0 ? `(${kbMetadata.rolePrompt.chars} 字符)` : ''}\n豆包知识库 (${kbMetadata.doubaoKb.name}): ${doubaoStatus} ${kbMetadata.doubaoKb.chars > 0 ? `(${kbMetadata.doubaoKb.chars} 字符)` : ''}`,
                status: 'done'
            });
        }

        // Add model's own thought process from API response
        if (response.thoughtProcess && Array.isArray(response.thoughtProcess)) {
            response.thoughtProcess.forEach((step, index) => {
                // Choose icon based on knowledgeUsed
                let icon = '💭';
                if (step.knowledgeUsed === '角色提示词') icon = '📖';
                else if (step.knowledgeUsed === '豆包知识库') icon = '🤖';
                else if (step.step.includes('决策') || step.step.includes('生成')) icon = '✅';
                else if (step.step.includes('解析') || step.step.includes('需求')) icon = '🎯';

                thoughts.push({
                    id: `thought-${index}`,
                    icon: icon,
                    title: step.step + (step.knowledgeUsed ? ` [${step.knowledgeUsed}]` : ''),
                    content: step.content,
                    status: 'done'
                });
            });
        }

        let finalText = response.text;

        // Updated: Only show summary, do not show full prompts in chat
        if (response.visualPrompts && response.visualPrompts.length > 0) {
            const ratioText = response.aspectRatio ? ` (推荐尺寸: ${response.aspectRatio})` : '';
            finalText += `\n\n---\n\n### ✅ 方案已生成\n已根据您的需求定制了 4 组视觉提示词${ratioText}。请在右侧查看生成的视觉参考图及其对应的提示词详情。`;
        }

        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            sender: Sender.AI,
            text: finalText,
            timestamp: Date.now(),
            thoughts: thoughts.length > 0 ? thoughts : undefined
        }]);

        // If Gemini returns visual prompts, trigger generation
        if (response.visualPrompts && response.visualPrompts.length > 0) {
            const ratio = response.aspectRatio || "1:1";
            setCurrentAspectRatio(ratio);
            handleImageGeneration(response.visualPrompts, ratio, response.reasoning);
        }
    };

    const handleImageGeneration = async (prompts: string[], aspectRatio: string, reasoning?: string) => {
        if (iterationCount >= MAX_ITERATIONS) {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                sender: Sender.System,
                text: "已达到最大迭代次数限制。请下载满意的结果或开始新会话。",
                timestamp: Date.now()
            }]);
            return;
        }

        // Ensure we have exactly 4 prompts (fallback if logic elsewhere failed)
        const filledPrompts = [...prompts];
        while (filledPrompts.length < 4) {
            filledPrompts.push(filledPrompts[0]);
        }
        const finalPrompts = filledPrompts.slice(0, 4);

        setIsGenerating(true);
        setCurrentPrompts(finalPrompts);

        // Add a system note about what's happening
        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            sender: Sender.System,
            text: reasoning ? `✅ ${reasoning}` : "✅ 信息充足，正在生成视觉素材...",
            timestamp: Date.now()
        }]);

        // Generate 4 images in parallel using distinct prompts and the recommended aspect ratio
        const currentSessionId = sessionIdRef.current;
        const promises = finalPrompts.map(p => generateImageWithDoubao(p, aspectRatio));
        const results = await Promise.all(promises);

        // Race Condition Check
        if (sessionIdRef.current !== currentSessionId) return;

        const newImages: GeneratedImage[] = results.map((url, index) => ({
            id: `${Date.now()}-${index}`,
            url,
            prompt: finalPrompts[index], // Store the specific prompt for this image
            selected: false
        }));

        setImages(newImages);
        setIterationCount(prev => prev + 1);
        setIsGenerating(false);
    };

    const handleImageSelect = (id: string) => {
        setImages(prev => prev.map(img => ({
            ...img,
            selected: img.id === id ? !img.selected : img.selected
        })));
    };

    const handleDownload = (url: string, id: string) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = `visual-bridge-asset-${id}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleRegenerate = () => {
        if (currentPrompts.length > 0) {
            handleImageGeneration(currentPrompts, currentAspectRatio, "用户要求基于当前提示词重新生成。");
        }
    };

    const handleReset = () => {
        setShowResetConfirm(true);
    };

    const confirmReset = () => {
        // Update Session ID to invalidate any pending async tasks
        sessionIdRef.current = Date.now();

        // Clear storage
        localStorage.removeItem(SESSION_STORAGE_KEY);

        // Reset state
        setMessages([{
            id: 'welcome',
            sender: Sender.AI,
            text: "您好！我是 VisualBridge AI。\n\n为了帮您生成最准确的视觉素材，我会先询问您关于**场景、主体、风格和色调**的细节。\n\n请告诉我您的初步想法，例如：\n> \"我需要一张科技感的大会海报，主体是一个发光的芯片。\"",
            timestamp: Date.now()
        }]);
        setImages([]);
        setIterationCount(0);
        setCurrentPrompts([]);
        setCurrentAspectRatio("1:1");
        setShowResetConfirm(false);
    };

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <header className="h-16 border-b border-gray-200 flex items-center justify-between px-6 bg-white shrink-0 z-10">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                        <Sparkles size={18} />
                    </div>
                    <h1 className="text-xl font-bold text-gray-800 tracking-tight">VisualBridge AI (视觉桥梁)</h1>
                    <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 ml-2">MVP 1.2</span>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setShowSettings(true)}
                        className="text-gray-500 hover:text-indigo-600 transition-colors flex items-center gap-1 text-sm font-medium"
                    >
                        <Settings size={16} />
                        配置 (Settings)
                    </button>
                    <button
                        onClick={handleReset}
                        className="text-gray-500 hover:text-red-600 transition-colors flex items-center gap-1 text-sm font-medium"
                    >
                        <RotateCcw size={14} />
                        新会话
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex overflow-hidden">

                {/* Left Panel: Chat Interface */}
                <div className="w-1/3 min-w-[360px] border-r border-gray-200 flex flex-col bg-gray-50/50">
                    <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-hide">
                        {messages.map((msg) => (
                            <ChatMessage key={msg.id} message={msg} />
                        ))}
                        {isTyping && (
                            <ChatMessage message={{
                                id: 'typing',
                                sender: Sender.AI,
                                text: '思考中...',
                                timestamp: Date.now(),
                                isThinking: true
                            }} />
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-4 bg-white border-t border-gray-200">
                        <div className="relative">
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage();
                                    }
                                }}
                                placeholder="描述您的视觉需求... (例如：'我需要一个未来感的背景')"
                                className="w-full pl-4 pr-12 py-3 bg-gray-100 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all resize-none text-sm shadow-inner"
                                rows={3}
                                disabled={isGenerating || isTyping}
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={!input.trim() || isGenerating || isTyping}
                                className="absolute right-3 bottom-3 p-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-lg transition-colors shadow-sm"
                            >
                                <Send size={16} />
                            </button>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2 text-center">
                            AI 会将“高端大气”等行业术语转化为专业的设计提示词。
                        </p>
                    </div>
                </div>

                {/* Right Panel: Image Display & Controls */}
                <div className="flex-1 flex flex-col bg-white relative">
                    <ImageGallery
                        images={images}
                        isGenerating={isGenerating}
                        onSelect={handleImageSelect}
                        onDownload={handleDownload}
                        iterationCount={iterationCount}
                        maxIterations={MAX_ITERATIONS}
                    />

                    {/* Sticky Action Bar */}
                    {images.length > 0 && (
                        <div className="p-4 border-t border-gray-200 bg-white/95 backdrop-blur-sm flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                            <div className="text-sm text-gray-600">
                                已选择 <span className="font-semibold">{images.filter(i => i.selected).length}</span> 张
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleRegenerate}
                                    disabled={isGenerating || iterationCount >= MAX_ITERATIONS}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg shadow-sm disabled:opacity-50 transition-all flex items-center gap-2"
                                >
                                    <RotateCcw size={16} />
                                    优化并重新生成
                                </button>
                                <button
                                    onClick={() => {
                                        const selected = images.filter(i => i.selected);
                                        if (selected.length === 0) {
                                            alert("请至少选择一张图片进行导出。");
                                            return;
                                        }
                                        selected.forEach(img => handleDownload(img.url, img.id));
                                    }}
                                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md shadow-indigo-200 transition-all flex items-center gap-2"
                                >
                                    <ImageIcon size={16} />
                                    导出选中图片
                                </button>
                            </div>
                        </div>
                    )}
                </div>

            </main>



            {/* Reset Confirmation Modal */}
            {showResetConfirm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">确认新会话</h3>
                        <p className="text-gray-600 mb-6">
                            确定要开始新会话吗？这将清除当前的历史记录。
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowResetConfirm(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={confirmReset}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors"
                            >
                                确认清除
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <SettingsModal
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                onSave={() => {
                    window.location.reload(); // Reload to apply new keys to services
                }}
            />
        </div>
    );
};

export default App;