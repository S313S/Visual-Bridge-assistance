import React, { useState } from 'react';
import { ThoughtStep } from '../types';
import { ChevronDown, ChevronRight, Sparkles, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface ThoughtsPanelProps {
    thoughts: ThoughtStep[];
}

const ThoughtsPanel: React.FC<ThoughtsPanelProps> = ({ thoughts }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!thoughts || thoughts.length === 0) return null;

    const getStatusIcon = (status: ThoughtStep['status']) => {
        switch (status) {
            case 'loading':
                return <Loader2 size={12} className="animate-spin text-indigo-500" />;
            case 'done':
                return <CheckCircle size={12} className="text-green-500" />;
            case 'error':
                return <XCircle size={12} className="text-red-500" />;
        }
    };

    return (
        <div className="mb-2">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-2 text-xs text-indigo-600 hover:text-indigo-800 transition-colors py-1 px-2 rounded-lg hover:bg-indigo-50"
            >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <Sparkles size={12} />
                <span className="font-medium">Thoughts</span>
                <span className="text-gray-400">({thoughts.length} 步骤)</span>
            </button>

            {isExpanded && (
                <div className="mt-2 ml-2 border-l-2 border-indigo-100 pl-3 space-y-2">
                    {thoughts.map((step) => (
                        <div key={step.id} className="text-xs">
                            <div className="flex items-center gap-2 font-medium text-gray-700">
                                <span>{step.icon}</span>
                                <span>{step.title}</span>
                                {getStatusIcon(step.status)}
                            </div>
                            <div className="text-gray-500 mt-0.5 ml-5 whitespace-pre-wrap">
                                {step.content}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ThoughtsPanel;
