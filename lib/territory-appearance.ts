export type TerritoryTheme='light'|'mixed'|'dark';
export const themeLabels={light:'Claro',mixed:'Misto',dark:'Escuro'};
export function mapStyle(theme:TerritoryTheme){return `https://tiles.openfreemap.org/styles/${theme==='dark'?'dark':'liberty'}`;}
/** Ordem do ícone principal: a estrutura (líder, embaixador) e depois o nível na rede: Multiplicador (a indicação dele comprou) → Indicador (comprou e indicou) → Cliente (comprou) → demais papéis → Lead. */
export const roleLabels=['Líder','Embaixador','Multiplicador','Indicador','Cliente','Mentor','Mentorado','Cliente assinante','Equipe','Vendedor','Parceiro','Network','Lead'] as const;
export function primaryRole(roles:string[],filter='') {return filter&&roles.includes(filter)?filter:roleLabels.find(r=>roles.includes(r))??'Pessoa';}
