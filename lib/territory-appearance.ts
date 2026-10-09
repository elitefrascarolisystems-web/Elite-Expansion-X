export type TerritoryTheme='light'|'mixed'|'dark';
export const themeLabels={light:'Claro',mixed:'Misto',dark:'Escuro'};
export function mapStyle(theme:TerritoryTheme){return `https://tiles.openfreemap.org/styles/${theme==='dark'?'dark':'liberty'}`;}
export const roleLabels=['Líder','Embaixador','Mentor','Mentorado','Equipe','Vendedor','Parceiro','Lead','Cliente'] as const;
export function primaryRole(roles:string[],filter='') {return filter&&roles.includes(filter)?filter:roleLabels.find(r=>roles.includes(r))??'Pessoa';}
