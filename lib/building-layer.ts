import type {Map as MapInstance,FillExtrusionLayerSpecification} from 'maplibre-gl';
export const buildingLayer:FillExtrusionLayerSpecification={id:'elite-buildings-3d',type:'fill-extrusion',source:'elite-building-source','source-layer':'building',minzoom:15,filter:['!=',['get','hide_3d'],true],paint:{'fill-extrusion-color':'#a99053','fill-extrusion-opacity':0.82,'fill-extrusion-height':['coalesce',['get','render_height'],0],'fill-extrusion-base':['coalesce',['get','render_min_height'],0]}};
export function applyBuildings(map:MapInstance,enabled:boolean){
 for(const layer of map.getStyle().layers??[])if(layer.type==='fill-extrusion'&&layer.id!==buildingLayer.id)map.setLayoutProperty(layer.id,'visibility','none');
 if(enabled&&!map.getSource(buildingLayer.source))map.addSource(buildingLayer.source,{type:'vector',url:'https://tiles.openfreemap.org/planet'});
 if(enabled&&!map.getLayer(buildingLayer.id))map.addLayer(buildingLayer,map.getStyle().layers?.find(l=>l.type==='symbol')?.id);
 if(map.getLayer(buildingLayer.id))map.setLayoutProperty(buildingLayer.id,'visibility',enabled?'visible':'none');
}
