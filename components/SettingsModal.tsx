import React, { useState, useEffect } from 'react';
import { X, Save, Key, Database, Image as ImageIcon, MessageSquare, Github } from 'lucide-react';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
}

export interface AppConfig {
    volcApiKey: string;
    volcTextModel: string;
    volcImageModel: string;
    kbUrl: string;
    githubToken: string;
}

export const LOCAL_STORAGE_KEY = 'visual_bridge_config';

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave }) => {
    const [config, setConfig] = useState<AppConfig>({
        volcApiKey: '',
        volcTextModel: 'doubao-seed-1-8',
        volcImageModel: 'doubao-seedream-4-5',
        kbUrl: '',
        githubToken: ''
    });

    useEffect(() => {
        if (isOpen) {
            // Load from storage or env defaults
            const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (stored) {
                setConfig(JSON.parse(stored));
            } else {
                // Fallback to env vars if available (for initial load)
                // Note: verification logic will prefer storage over env if storage exists
                setConfig({
                    volcApiKey: '', // Don't pre-fill from env for security in UI, or maybe optional? 
                    // Actually, for better UX let's leave blank or load if user wants.
                    // For now, clean slate or storage.
                    volcTextModel: 'doubao-seed-1-8',
                    volcImageModel: 'doubao-seedream-4-5',
                    kbUrl: '',
                    githubToken: ''
                });
            }
        }
    }, [isOpen]);

    const handleChange = (key: keyof AppConfig, value: string) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = () => {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
        onSave();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Key size={18} className="text-indigo-600" />
                        应用配置 (Settings)
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                    {/* Volcengine Section */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-gray-900 border-b pb-2 flex items-center gap-2">
                            <MessageSquare size={16} /> 火山引擎 (Volcengine)
                        </h4>

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-600">API Key</label>
                            <input
                                type="password"
                                value={config.volcApiKey}
                                onChange={(e) => handleChange('volcApiKey', e.target.value)}
                                placeholder="61c8...."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-600">Text Model ID</label>
                                <input
                                    type="text"
                                    value={config.volcTextModel}
                                    onChange={(e) => handleChange('volcTextModel', e.target.value)}
                                    placeholder="ep-2025..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-600">Image Model ID</label>
                                <input
                                    type="text"
                                    value={config.volcImageModel}
                                    onChange={(e) => handleChange('volcImageModel', e.target.value)}
                                    placeholder="ep-2025..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    {/* GitHub Section */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-gray-900 border-b pb-2 flex items-center gap-2">
                            <Github size={16} /> 知识库 (GitHub Knowledge Base)
                        </h4>

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-600">API URL</label>
                            <div className="relative">
                                <Database size={14} className="absolute left-3 top-3 text-gray-400" />
                                <input
                                    type="text"
                                    value={config.kbUrl}
                                    onChange={(e) => handleChange('kbUrl', e.target.value)}
                                    placeholder="https://api.github.com/repos/user/repo/contents/file.md"
                                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-600">Personal Access Token (PAT)</label>
                            <input
                                type="password"
                                value={config.githubToken}
                                onChange={(e) => handleChange('githubToken', e.target.value)}
                                placeholder="github_pat_..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="text-xs text-gray-500 bg-amber-50 p-3 rounded-lg border border-amber-100">
                        <span className="font-semibold text-amber-600">注意：</span> 配置将仅保存在您浏览器的 LocalStorage 中，不会上传到任何服务器。
                    </div>
                </div>

                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm flex items-center gap-2 transition-colors"
                    >
                        <Save size={16} />
                        保存配置
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
