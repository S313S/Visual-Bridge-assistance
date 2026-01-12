import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, RotateCcw, Image as ImageIcon, Sparkles, AlertTriangle } from 'lucide-react';
import ChatMessage from './components/ChatMessage';
import ImageGallery from './components/ImageGallery';
import { AppState, Message, Sender, GeneratedImage } from './types';
import { sendMessageToDoubao, generateImageWithDoubao } from './services/volcengine';
import { fetchExternalKnowledge } from './services/knowledgeBase';
import { SYSTEM_INSTRUCTION } from './constants';

const App: React.FC = () => {
    // State
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            sender: Sender.AI,
            text: "您好！我是 VisualBridge AI。\n\n为了帮您生成最准确的视觉素材，我会先询问您关于**场景、主体、风格和色调**的细节。\n\n请告诉我您的初步想法，例如：\n> “我需要一张科技感的大会海报，主体是一个发光的芯片。”",
            timestamp: Date.now()
        }
    ]);
    const [input, setInput] = useState('');
    const [images, setImages] = useState<GeneratedImage[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [iterationCount, setIterationCount] = useState(0);
    const [currentPrompts, setCurrentPrompts] = useState<string[]>([]);
    const [currentAspectRatio, setCurrentAspectRatio] = useState<string>('1:1');
    const [showKeyModal, setShowKeyModal] = useState(false);
    const [systemContext, setSystemContext] = useState<string>('');

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const MAX_ITERATIONS = 7;

    // Auto-scroll chat
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    // Check API Key
    useEffect(() => {
        // Check for Volcengine API Key or fallback
        if (!process.env.VOLC_API_KEY && !process.env.API_KEY) {
            setShowKeyModal(true);
        }

        // Load Knowledge Base
        const loadKnowledge = async () => {
            const kb = await fetchExternalKnowledge();
            if (kb) {
                console.log("Knowledge Base loaded successfully");
                setSystemContext(kb);
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

        const response = await sendMessageToDoubao(history, userMsg.text, fullSystemInstruction);

        setIsTyping(false);

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
            timestamp: Date.now()
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
        const promises = finalPrompts.map(p => generateImageWithDoubao(p, aspectRatio));
        const results = await Promise.all(promises);

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
        if (window.confirm("确定要开始新会话吗？这将清除当前的历史记录。")) {
            setMessages([messages[0]]);
            setImages([]);
            setIterationCount(0);
            setCurrentPrompts([]);
            setCurrentAspectRatio("1:1");
        }
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

            {/* No Key Modal */}
            {showKeyModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
                        <div className="flex items-center gap-3 text-amber-500 mb-4">
                            <AlertTriangle size={24} />
                            <h3 className="text-lg font-bold text-gray-900">缺失 API 密钥</h3>
                        </div>
                        <p className="text-gray-600 mb-6">
                            此应用需要 Volcengine Doubao API Key 才能运行。
                            由于这是演示环境，请确保在运行时配置中设置了环境变量 <code>VOLC_API_KEY</code>。
                        </p>
                        <button
                            onClick={() => setShowKeyModal(false)}
                            className="w-full py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"
                        >
                            我明白了
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;