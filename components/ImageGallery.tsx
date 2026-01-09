import React, { useState } from 'react';
import { GeneratedImage } from '../types';
import { CheckCircle2, Download, RefreshCw, ZoomIn, AlertCircle, X, FileText, Copy, Check } from 'lucide-react';

interface ImageGalleryProps {
  images: GeneratedImage[];
  isGenerating: boolean;
  onSelect: (id: string) => void;
  onDownload: (url: string, id: string) => void;
  iterationCount: number;
  maxIterations: number;
}

const ImageGallery: React.FC<ImageGalleryProps> = ({ 
  images, 
  isGenerating, 
  onSelect, 
  onDownload,
  iterationCount,
  maxIterations
}) => {
  const [previewImage, setPreviewImage] = useState<GeneratedImage | null>(null);
  const [promptImage, setPromptImage] = useState<GeneratedImage | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (images.length === 0 && !isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 m-4">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <ZoomIn size={32} className="text-gray-300" />
        </div>
        <p className="font-medium text-lg">尚未生成视觉素材</p>
        <p className="text-sm mt-2 max-w-xs text-center">请与 AI 对话以明确您的需求并生成参考图。</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6">
        {/* Status Header */}
        <div className="flex justify-between items-center mb-6">
            <div>
                <h2 className="text-xl font-bold text-gray-800">视觉参考</h2>
                <p className="text-sm text-gray-500">点击图片预览，勾选以批量导出</p>
            </div>
            <div className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-sm font-medium">
                <RefreshCw size={14} />
                <span>迭代轮次 {iterationCount}/{maxIterations}</span>
            </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 gap-4 flex-1 overflow-y-auto pb-4">
            {isGenerating ? (
                // Loading Skeletons
                Array(4).fill(0).map((_, i) => (
                    <div key={i} className="aspect-square bg-gray-100 rounded-xl animate-pulse flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2 text-gray-300">
                             <div className="w-8 h-8 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin"></div>
                             <span className="text-xs font-medium">生成中...</span>
                        </div>
                    </div>
                ))
            ) : (
                images.map((img) => (
                    <div 
                        key={img.id} 
                        className={`group relative aspect-square rounded-xl overflow-hidden border-2 transition-all cursor-zoom-in ${
                            img.selected ? 'border-indigo-600 shadow-lg ring-2 ring-indigo-100' : 'border-transparent hover:border-gray-200'
                        }`}
                        onClick={() => setPreviewImage(img)}
                    >
                        {img.url ? (
                             <img 
                             src={img.url} 
                             alt="Generated asset" 
                             className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                         />
                        ) : (
                            <div className="w-full h-full bg-gray-100 flex flex-col items-center justify-center text-gray-400 p-4 text-center">
                                <AlertCircle className="mb-2" />
                                <span className="text-xs">加载失败</span>
                            </div>
                        )}
                       
                        {/* Overlay Actions */}
                        <div className={`absolute inset-0 bg-black/40 transition-opacity flex flex-col justify-end p-3 ${img.selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                            <div className="flex justify-between items-end">
                                {/* Selection Toggle - Clickable separately */}
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSelect(img.id);
                                    }}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                        img.selected 
                                        ? 'bg-indigo-600 text-white scale-100' 
                                        : 'bg-white/20 text-white border border-white/50 hover:bg-white/40 hover:scale-110'
                                    }`}
                                    title={img.selected ? "取消选择" : "选择"}
                                >
                                    <CheckCircle2 size={16} />
                                </button>

                                <div className="flex gap-2">
                                    {/* View Prompt Button */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setPromptImage(img);
                                        }}
                                        className="p-2 bg-white/90 hover:bg-white text-gray-700 rounded-lg shadow-sm transition-colors"
                                        title="查看提示词"
                                    >
                                        <FileText size={16} />
                                    </button>
                                    
                                    {/* Direct Download */}
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDownload(img.url, img.id);
                                        }}
                                        className="p-2 bg-white/90 hover:bg-white text-gray-700 rounded-lg shadow-sm transition-colors"
                                        title="下载"
                                    >
                                        <Download size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>

        {/* Prompt Modal */}
        {promptImage && (
             <div 
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
                onClick={() => setPromptImage(null)}
            >
                 <div 
                    className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <FileText size={20} className="text-indigo-600" />
                            图像提示词 (Prompt)
                        </h3>
                        <button onClick={() => setPromptImage(null)} className="text-gray-400 hover:text-gray-600">
                            <X size={20} />
                        </button>
                    </div>
                    
                    <div className="p-6 overflow-y-auto bg-gray-50/50">
                        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                             <p className="text-sm leading-relaxed text-gray-700 font-mono whitespace-pre-wrap">
                                {promptImage.prompt}
                             </p>
                        </div>
                    </div>

                    <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-white">
                        <button 
                            onClick={() => handleCopy(promptImage.prompt)}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                        >
                            {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                            {copied ? "已复制" : "复制文本"}
                        </button>
                        <button 
                            onClick={() => setPromptImage(null)}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            关闭
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Preview Modal */}
        {previewImage && (
            <div 
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 animate-in fade-in duration-200"
                onClick={() => setPreviewImage(null)}
            >
                {/* Close Button */}
                <button 
                    onClick={() => setPreviewImage(null)}
                    className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors z-50"
                >
                    <X size={24} />
                </button>

                {/* Content Container */}
                <div 
                    className="relative flex flex-col items-center w-full h-full justify-center"
                    onClick={(e) => e.stopPropagation()}
                >
                    <img 
                        src={previewImage.url} 
                        alt="Preview" 
                        className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
                    />
                    
                    {/* Bottom Actions Bar for Preview */}
                    <div className="mt-6 flex gap-4">
                        <button 
                            onClick={() => {
                                setPromptImage(previewImage);
                                setPreviewImage(null);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                        >
                            <FileText size={18} />
                            查看提示词
                        </button>
                        <button 
                            onClick={() => onDownload(previewImage.url, previewImage.id)}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                        >
                            <Download size={18} />
                            下载图片
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default ImageGallery;