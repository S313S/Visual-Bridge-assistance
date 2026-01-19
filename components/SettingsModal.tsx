import React, { useState, useEffect } from 'react';
import { X, Save, Key, Database, MessageSquare, Github, Cloud, Wrench } from 'lucide-react';
import { isWorkerMode } from '../services/volcengine';

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
    doubaoKbUrl: string;
    githubToken: string;
}

export const LOCAL_STORAGE_KEY = 'visual_bridge_config';

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave }) => {
    const [config, setConfig] = useState<AppConfig>({
        volcApiKey: '',
        volcTextModel: '',
        volcImageModel: '',

        kbUrl: 'https://github.com/S313S/Obsidian/blob/main/Prompts/DesignDirector.md',
        doubaoKbUrl: 'https://github.com/S313S/Obsidian/blob/main/knowledge_base/doubao_knowledge_base/SUMMARIED_KNOWLEDGE_BASE.md',
        githubToken: ''
    });

    // Detect Worker mode
    const workerMode = isWorkerMode();

    useEffect(() => {
        if (isOpen) {
            const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (stored) {
                setConfig(JSON.parse(stored));
            } else {
                setConfig({
                    volcApiKey: '',
                    volcTextModel: 'doubao-seed-1-8-251228',
                    volcImageModel: 'doubao-seedream-4-5-251128',
                    kbUrl: 'https://github.com/S313S/Obsidian/blob/main/Prompts/DesignDirector.md',
                    doubaoKbUrl: 'https://github.com/S313S/Obsidian/blob/main/knowledge_base/doubao_knowledge_base/SUMMARIED_KNOWLEDGE_BASE.md',
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

                <div className="flex-1 p-6 overflow-y-auto space-y-6">
                    {/* Mode Indicator */}
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${workerMode ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                        {workerMode ? <Cloud size={16} /> : <Wrench size={16} />}
                        <span className="font-medium">
                            {workerMode ? '云端模式 (Worker Mode)' : '本地调试模式 (Direct Mode)'}
                        </span>
                        {workerMode && (
                            <span className="text-xs text-green-600">API Key 由云端安全管理</span>
                        )}
                    </div>

                    {/* Volcengine Section - Only show in Direct Mode */}
                    {!workerMode && (
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
                                    <label className="text-xs font-medium text-gray-600">Text Model Endpoint ID</label>
                                    <input
                                        type="text"
                                        value={config.volcTextModel}
                                        onChange={(e) => handleChange('volcTextModel', e.target.value)}
                                        placeholder="doubao-seed-1-8-251228"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-300"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-600">Image Model Endpoint ID</label>
                                    <input
                                        type="text"
                                        value={config.volcImageModel}
                                        onChange={(e) => handleChange('volcImageModel', e.target.value)}
                                        placeholder="doubao-seedream-4-5-251128"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-300"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Knowledge Base Section - Always show */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-gray-900 border-b pb-2 flex items-center gap-2">
                            <Github size={16} /> 知识库配置 (Knowledge Base)
                        </h4>

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-600">角色提示词 URL (Role Prompt)</label>
                            <div className="relative">
                                <Database size={14} className="absolute left-3 top-3 text-gray-400" />
                                <input
                                    type="text"
                                    value={config.kbUrl}
                                    onChange={(e) => handleChange('kbUrl', e.target.value)}
                                    placeholder="https://github.com/user/repo/blob/main/prompts/role.md"
                                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                />
                            </div>
                            <p className="text-[10px] text-gray-400">填写 GitHub 文件链接，用于加载角色人设</p>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-600">豆包知识库 URL (Doubao KB)</label>
                            <div className="relative">
                                <Database size={14} className="absolute left-3 top-3 text-gray-400" />
                                <input
                                    type="text"
                                    value={config.doubaoKbUrl}
                                    onChange={(e) => handleChange('doubaoKbUrl', e.target.value)}
                                    placeholder="https://github.com/user/repo/blob/main/kb/doubao.md"
                                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        {/* GitHub Token - Only show in Direct Mode */}
                        {!workerMode && (
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-600">Personal Access Token (PAT)</label>
                                <input
                                    type="password"
                                    value={config.githubToken}
                                    onChange={(e) => handleChange('githubToken', e.target.value)}
                                    placeholder="github_pat_..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                />
                                <p className="text-[10px] text-gray-400">私有仓库需要 Token，公开仓库可留空</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="text-xs text-gray-500 bg-amber-50 p-3 mx-6 mb-4 rounded-lg border border-amber-100">
                    <span className="font-semibold text-amber-600">注意：</span> 配置仅保存在浏览器 LocalStorage 中，不会上传到任何服务器。
                    {workerMode && <span className="block mt-1 text-green-600">敏感信息（API Key、Token）已集中安全管理存储。</span>}
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
