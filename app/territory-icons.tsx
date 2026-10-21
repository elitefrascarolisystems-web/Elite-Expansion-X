import {Building2,Flag,Shield,Compass,GraduationCap,Users,Handshake,Store,CalendarDays,Target,UserPlus,BadgeCheck,Clock,MapPin,UserRound,Gem,Waypoints,Crown,Network,School,MapPinned,ShoppingBag,UtensilsCrossed,HeartPulse,Sparkles,BookOpen,Cpu,Factory,HardHat,House,Landmark,Wheat,Briefcase,Truck,Car,Ticket,Dumbbell,Church,Building,Scale} from 'lucide-react';
import {primaryRole} from '@/lib/territory-appearance';
import {placeIconLabel} from '@/lib/places';

/** Pessoas: ícone pelo papel principal. */
export const personIcons={Líder:Flag,Embaixador:Shield,Mentor:Compass,Mentorado:GraduationCap,Assinante:Gem,Equipe:Users,Vendedor:UserRound,Parceiro:Handshake,Network:Waypoints,Cliente:BadgeCheck,Lead:UserPlus,Pessoa:UserRound};
/** Locais que não são empresa: ícone pelo tipo. */
export const placeTypeIcons={'Escritório':Crown,'Network / comunidade':Network,'Instituição de ensino':School,'Ponto de encontro':MapPinned};
/** Empresas: ícone pelo setor. */
export const sectorIcons={'Comércio e varejo':ShoppingBag,Alimentação:UtensilsCrossed,Saúde:HeartPulse,'Beleza e estética':Sparkles,Educação:BookOpen,Tecnologia:Cpu,Indústria:Factory,Construção:HardHat,Imobiliário:House,'Finanças e seguros':Landmark,Agronegócio:Wheat,'Serviços profissionais':Briefcase,'Transporte e logística':Truck,Automotivo:Car,'Turismo e eventos':Ticket,'Esporte e lazer':Dumbbell,Religioso:Church,'Associação / entidade':Building,'Governo / público':Scale,Outro:Store,Empresa:Store};
/** Demais registros do mapa. */
export const otherIcons={Cidade:Building2,'Ponto parceiro':Handshake,Evento:CalendarDays,Ação:Target,'Follow-up':Clock,Pendente:MapPin};
export const territoryIcons={...personIcons,...placeTypeIcons,...sectorIcons,...otherIcons};

export function iconLabel(roles:string[],kind:string,filter=''):string{
 if(kind==='person')return primaryRole(roles,filter);
 if(kind==='business')return placeIconLabel(roles);
 return ({city:'Cidade',partner:'Ponto parceiro',event:'Evento',action:roles.includes('Follow-up')?'Follow-up':'Ação'} as Record<string,string>)[kind]??'Pessoa';
}
export function TerritoryIcon({roles,kind,filter='',size=19}:{roles:string[];kind:string;filter?:string;size?:number}) {const Icon=territoryIcons[iconLabel(roles,kind,filter) as keyof typeof territoryIcons]??UserRound;return <Icon size={size} aria-hidden="true"/>;}
