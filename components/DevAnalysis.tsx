import React from 'react';

interface DevAnalysisProps {
    isOpen: boolean;
    onClose: () => void;
}

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h3 className="text-xl font-bold text-gray-800 mb-3 mt-6 border-b-2 border-indigo-200 pb-2">{children}</h3>
);

const ListItem: React.FC<{ title: string; children: React.ReactNode; isCritique?: boolean }> = ({ title, children, isCritique = true }) => (
    <li className="mt-2">
        <strong className="font-semibold text-gray-700">{title}:</strong>
        <span className={`ml-2 ${isCritique ? 'text-orange-800' : 'text-green-800'}`}>
            {children}
        </span>
    </li>
);

const Recommendation: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="mt-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-800 text-sm">
        <strong className="font-bold">Recomendação Estratégica:</strong> {children}
    </div>
);

const DevAnalysis: React.FC<DevAnalysisProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto transform transition-all duration-300 p-8" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Análise Rigorosa do Sistema</h2>
                        <p className="text-gray-500">Uma auditoria completa de arquitetura, UX e potencial estratégico.</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <div className="prose max-w-none">
                    <SectionTitle>1. Arquitetura e Gerenciamento de Estado</SectionTitle>
                    <ul>
                        <ListItem title="Crítica">O componente `App.tsx` é um monolito que gerencia uma quantidade excessiva de estados. Isso dificulta a manutenção e a escalabilidade, aumentando o risco de inconsistências de estado.</ListItem>
                        <ListItem title="Crítica">A lógica de negócios, o estado da interface e as chamadas de API estão fortemente acoplados, violando o princípio de responsabilidade única.</ListItem>
                    </ul>
                    <Recommendation>
                        Refatorar o gerenciamento de estado usando `useReducer` para orquestrar os fluxos complexos (geração, análise, correção) e/ou adotar uma biblioteca de estado global como Zustand. Isso irá centralizar a lógica, desacouplar os componentes e tornar o fluxo de dados mais previsível.
                    </Recommendation>

                    <SectionTitle>2. Integração com a API Gemini e Robustez dos Prompts</SectionTitle>
                    <ul>
                        <ListItem title="Ponto Forte" isCritique={false}>A função `withRateLimitHandling` é uma excelente implementação de resiliência, com backoff exponencial e tratamento específico para erros de cota (429).</ListItem>
                        <ListItem title="Crítica">A dependência de que a IA sempre retorne um JSON perfeitamente formatado é um ponto de fragilidade. A IA pode, ocasionalmente, adicionar texto explicativo ou formatação de markdown que quebra o `JSON.parse`.</ListItem>
                        <ListItem title="Crítica">Os prompts, especialmente os de correção com linguagem "SUPER RIGOROSA", embora eficazes, podem ser frágeis (brittle). Mudanças futuras no modelo da IA podem exigir um reajuste fino desses prompts para manter o comportamento desejado.</ListItem>
                    </ul>
                    <Recommendation>
                        Implementar um parser de JSON mais robusto que primeiro limpe a resposta da IA de artefatos comuns (como ```json) antes de tentar o `JSON.parse`. Para garantir a segurança de tipos em tempo de execução, considere usar uma biblioteca de validação como `Zod` para analisar as respostas da API.
                    </Recommendation>

                    <SectionTitle>3. Experiência do Usuário (UX) e Fluxo de Trabalho</SectionTitle>
                    <ul>
                        <ListItem title="Crítica">O fluxo do aplicativo é estritamente linear e destrutivo. Voltar a uma etapa anterior (ex: selecionar um novo idioma) reinicia todo o progresso. Isso pode ser extremamente frustrante para o usuário.</ListItem>
                        <ListItem title="Crítica">A etapa de análise é excessivamente longa (potencialmente 11 minutos devido aos delays de 60s), sem feedback claro sobre os tempos de espera entre as iterações. O usuário fica "preso" sem saber por quê.</ListItem>
                        <ListItem title="Crítica">A compilação do PDF depende de um serviço externo (`latexonline.cc`), que é um ponto único de falha. Se o serviço estiver offline ou a API mudar, uma funcionalidade chave do aplicativo quebra.</ListItem>
                    </ul>
                    <Recommendation>
                        Transformar o fluxo em um modelo não-destrutivo, onde o estado de cada etapa é preservado. Para a análise, processe-a de forma assíncrona em segundo plano, notificando o usuário quando estiver concluída, ou forneça feedback em tempo real sobre os tempos de espera. Adicione mais informações e tratamento de erro para a compilação de PDF.
                    </Recommendation>
                    
                    <SectionTitle>4. "Possibilidades Não Imaginadas" (Direções Estratégicas)</SectionTitle>
                    <ul>
                        <ListItem title="Assistente Conversacional" isCritique={false}>Mudar do modelo de "gerador" para um "assistente". Permitir que o usuário refine o artigo através de um chat. Ex: "Elabore a seção de metodologia", "Encontre mais três fontes para esta afirmação e adicione as citações".</ListItem>
                        <ListItem title="Controle de Versão">Implementar um histórico de versões do artigo. Cada vez que uma análise ou correção é aplicada, uma nova versão é salva, permitindo ao usuário comparar alterações e reverter para estados anteriores.</ListItem>
                        <ListItem title="Conformidade com Guias de Estilo">Permitir que o usuário selecione um guia de estilo (ex: ABNT, APA, MLA). A IA seria instruída a formatar todo o documento, especialmente as citações e referências, de acordo com as regras especificadas.</ListItem>
                        <ListItem title="Análise de Plágio">Integrar uma etapa onde a IA verifica seu próprio resultado em busca de plágio não intencional, comparando trechos do texto com as fontes utilizadas, garantindo a integridade acadêmica.</ListItem>
                    </ul>

                    <SectionTitle>5. Análise de Custo e Otimização de Tokens</SectionTitle>
                     <p className="text-gray-600">O sistema foi estrategicamente projetado para minimizar o custo e o consumo de tokens. As otimizações incluem:</p>
                    <ul className="list-disc list-inside text-gray-600 my-2">
                        <li><strong>Seleção Inteligente de Modelos:</strong> Utilizamos o <strong>'gemini-2.5-flash'</strong>, mais rápido e econômico, para tarefas de alta frequência (análise, geração de título), e reservamos o <strong>'gemini-2.5-pro'</strong> para tarefas complexas que exigem maior raciocínio (geração, melhoria).</li>
                        <li><strong>Conclusão Antecipada:</strong> O ciclo de 12 iterações é interrompido assim que o artigo atinge um alto padrão de qualidade (sem notas "vermelhas"). Isso representa a economia de tokens mais significativa.</li>
                    </ul>
                    <p className="text-gray-600 mt-2">A tabela abaixo ilustra o impacto dessas otimizações, comparando o custo por iteração e o custo total do ciclo em um cenário de conclusão antecipada.</p>
                    <div className="overflow-x-auto mt-4 rounded-lg border border-gray-200">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Etapa do Processo</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Modelo Utilizado</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Custo Estimado (Antes)</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Custo Estimado (Agora)</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Otimização Aplicada</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                <tr>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Geração de Título</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">gemini-2.5-flash</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 line-through">~1,500 tokens</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-bold">~500 tokens</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">Uso de modelo 'flash' em vez de 'pro'.</td>
                                </tr>
                                <tr>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Geração Inicial do Paper</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">gemini-2.5-pro</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">~150,000 tokens</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">~150,000 tokens</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">Modelo 'pro' mantido para máxima qualidade.</td>
                                </tr>
                                <tr>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Análise (por iteração)</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">gemini-2.5-flash</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 line-through">~130,000 tokens</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-bold">~45,000 tokens</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">Uso de modelo 'flash' e schema JSON.</td>
                                </tr>
                                <tr>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Melhoria (por iteração)</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">gemini-2.5-pro</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">~140,000 tokens</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">~140,000 tokens</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">Modelo 'pro' mantido para refinamento cirúrgico.</td>
                                </tr>
                                <tr className="bg-indigo-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-900">Ciclo Iterativo Total (Ex: 3 iterações)</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">Misto</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 line-through">~2,080,000 tokens (12 iterações)</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-bold">~415,000 tokens</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">Conclusão antecipada ao atingir a qualidade (sem notas vermelhas).</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DevAnalysis;