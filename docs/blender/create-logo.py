"""HTML God original sculptural logo. Run through HTML-Sensei blender_run.py.
Exports .blend, GLB, a transparent Cycles poster and a browser mesh snapshot.
"""
import bpy, math, os, sys, json
from mathutils import Vector
OUT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','assets'))
os.makedirs(OUT,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1.0

def material(name,color,metal=0.0,rough=.25,emission=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1)
    if bpy.app.version<(5,0,0):m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    if emission:p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
    return m
metal=material('Pearlescent titanium',(.35,.42,.56),.92,.19)
gold=material('Solar gold inlay',(1,.42,.09),.82,.2,.35)
teal=material('Ion cyan',(.04,.85,.72),.52,.18,2.8)
violet=material('Ultraviolet',(.43,.12,.95),.55,.19,1.8)
coremat=material('Creation core',(.12,.48,.68),.55,.16,.6)

def bracket(name,mirror=False):
    pts=[(-.58,1.35),(-1.83,.0),(-.58,-1.35),(-.24,-1.06),(-1.21,0),(-.24,1.06)]
    if mirror:pts=[(-x,y)for x,y in pts][::-1]
    n=len(pts);v=[(x,y,z)for z in[-.19,.19]for x,y in pts]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n)for i in range(n)]
    me=bpy.data.meshes.new(name);me.from_pydata(v,[],faces);me.update();obj=bpy.data.objects.new(name,me);scene.collection.objects.link(obj);obj.data.materials.append(metal)
    bevel=obj.modifiers.new('Precision machined bevels','BEVEL');bevel.width=.105;bevel.segments=6
    return obj
left=bracket('Left code bracket');right=bracket('Right code bracket',True)

def tube(name,points,r,mat):
    cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.bevel_depth=r;cu.bevel_resolution=4
    sp=cu.splines.new('POLY');sp.points.add(len(points)-1)
    for p,co in zip(sp.points,points):p.co=(*co,1)
    ob=bpy.data.objects.new(name,cu);scene.collection.objects.link(ob);ob.data.materials.append(mat);return ob
for sign in[-1,1]:tube('Luminous inset '+str(sign),[(sign*.49,1.16,.21),(sign*1.49,0,.21),(sign*.49,-1.16,.21)],.025,gold)
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4,radius=.36,location=(0,0,.12));core=bpy.context.object;core.name='The creation core';core.data.materials.append(coremat)
for p in core.data.polygons:p.use_smooth=True
for i,(mat,tilt,rad)in enumerate([(gold,0,.63),(teal,0,.39)]):
    bpy.ops.mesh.primitive_torus_add(major_radius=rad,minor_radius=.014 if i<2 else .018,major_segments=160,minor_segments=8,location=(0,0,.04))
    ob=bpy.context.object;ob.name='Orbital filament '+str(i);ob.rotation_euler=(tilt,.19 if i%2 else -.2,.28*i);ob.data.materials.append(mat)
    for p in ob.data.polygons:p.use_smooth=True
# A luminous central iris and a dark vertical pupil: a magical eye, no outer orbits.
pupilmat=material('Obsidian eye pupil',(.002,.004,.012),.25,.14)
bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,radius=1,location=(0,0,.43));ob=bpy.context.object;ob.name='The eye pupil';ob.scale=(.07,.235,.055);ob.data.materials.append(pupilmat)
for p in ob.data.polygons:p.use_smooth=True
for i in range(24):
    a=i*math.tau/24
    tube('Iris ray '+str(i),[(.43*math.cos(a),.43*math.sin(a),.16),(.54*math.cos(a),.54*math.sin(a),.16)],.008,teal if i%3 else violet)
world=bpy.data.worlds.new('Obsidian studio');scene.world=world
if bpy.app.version<(5,0,0):world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.025,.035,.065,1);world.node_tree.nodes['Background'].inputs[1].default_value=.3

def area(name,loc,color,power,size):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size
    ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=(Vector((0,0,0))-ob.location).to_track_quat('-Z','Y').to_euler()
area('Soft silver key',(-3,4,5),(.8,.87,1),650,5)
area('Cyan rim',(3,-1,2),(.06,1,.75),460,3)
area('Amber edge',(-4,-2,1),(1,.36,.08),500,3)
area('Ultraviolet fill',(1,3,-2),(.49,.12,1),600,3)
camdata=bpy.data.cameras.new('Logo portrait camera');cam=bpy.data.objects.new('Logo portrait camera',camdata);scene.collection.objects.link(cam);cam.location=(.4,.25,8);cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler();camdata.type='ORTHO';camdata.ortho_scale=5.3;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=64;scene.cycles.use_denoising=True
scene.render.resolution_x=1400;scene.render.resolution_y=1400;scene.render.resolution_percentage=100;scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
# Apply geometry through the evaluated dependency graph for a lightweight, dependency-free viewer.
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();meshdata=[]
for ob in list(scene.objects):
    if ob.type not in{'MESH','CURVE'}:continue
    ev=ob.evaluated_get(deps);me=ev.to_mesh();me.calc_loop_triangles();positions=[];normals=[];matrix=ev.matrix_world;normalmatrix=matrix.to_3x3().inverted().transposed()
    for tri in me.loop_triangles:
        for vi,li in zip(tri.vertices,tri.loops):
            v=matrix@me.vertices[vi].co
            try:n=normalmatrix@me.corner_normals[li].vector
            except Exception:n=normalmatrix@tri.normal
            n.normalize();positions.extend(round(c,6)for c in v);normals.extend(round(c,6)for c in n)
    mat=ob.data.materials[0];p=mat.node_tree.nodes.get('Principled BSDF');col=list(p.inputs['Base Color'].default_value)[:3]
    meshdata.append({'name':ob.name,'positions':positions,'normals':normals,'color':col,'metallic':p.inputs['Metallic'].default_value,'roughness':p.inputs['Roughness'].default_value,'emission':p.inputs['Emission Strength'].default_value})
    ev.to_mesh_clear()
with open(os.path.join(OUT,'html-god-logo-mesh.json'),'w',encoding='utf-8')as f:json.dump({'generator':'Blender '+bpy.app.version_string,'meshes':meshdata,'triangles':sum(len(m['positions'])//9 for m in meshdata)},f,separators=(',',':'))
props=set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys());opts={'filepath':os.path.join(OUT,'html-god-logo.glb'),'export_format':'GLB','export_apply':True,'export_animations':False,'export_cameras':False,'export_lights':False};bpy.ops.export_scene.gltf(**{k:v for k,v in opts.items()if k in props})
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(os.path.dirname(__file__),'html-god-logo.blend'))
scene.render.filepath=os.path.join(OUT,'html-god-logo.png');bpy.ops.render.render(write_still=True)
with open(os.path.join(os.path.dirname(__file__),'logo-report.json'),'w')as f:json.dump({'blender':bpy.app.version_string,'triangles':sum(len(m['positions'])//9 for m in meshdata),'objects':len(meshdata),'outputs':['html-god-logo.glb','html-god-logo-mesh.json','html-god-logo.png'],'render':'Cycles CPU, 64 samples, denoised, transparent 1400x1400'},f,indent=2)
print('EXPORTED HTML God logo, GLB, browser mesh, blend source and transparent poster')
