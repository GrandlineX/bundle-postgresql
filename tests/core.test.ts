
 import * as Path from 'path';

import { TestEntity, TestKernel } from './DebugClasses';
 import {
  CoreDBCon,
  CoreEntity,
  CoreEntityWrapper,
  createFolderIfNotExist,
  ICoreKernelModule, removeFolderIfExist, sleep
} from "@grandlinex/core";



const appName = 'TestKernel';
const appCode = 'tkernel';
const msiPath = Path.join(__dirname, '..', 'data');
const testPath = Path.join(__dirname, '..', 'data', 'config');


 createFolderIfNotExist(msiPath);
 createFolderIfNotExist(testPath);


 let kernel = new TestKernel(appName,appCode,testPath);

const testText = 'hello_world';

describe('Clean start', () => {
   test('preload', async () => {
    expect(kernel.getState()).toBe('init');
  });
  test('start kernel', async () => {
    const result = await kernel.start();
    expect(result).toBe(true);
    expect(kernel.getModCount()).toBe(1);
    expect(kernel.getState()).toBe('running');
  });})


describe('Database', () => {
  test('get version', async () => {
    expect(kernel.getState()).toBe('running');
    const db = kernel.getDb();
    expect(db).not.toBeNull()
    const conf = await db?.getConfig('dbversion');
    expect(conf?.c_value).not.toBeNull();
  });

  test('config test', async () => {
    expect(kernel.getState()).toBe('running');
    const db = kernel.getDb();
    expect(db).not.toBeNull()
    if (db){
      const conf = await db.setConfig(testText, testText);
      expect(conf).toBeTruthy();
      const res = await db.getConfig(testText);
      expect(res?.c_value).toBe(testText);
      await db.removeConfig(testText);
      const res2 = await db.getConfig(testText);
      expect(res2).toBeUndefined();

      expect(await db?.setConfig("test","test")).toBeTruthy();
      await db?.removeConfig("test")
      expect(await db?.configExist("test")).toBeFalsy()
    }
  });
})
describe('TestDatabase', () => {
  test('get version', async () => {
    const db = kernel.getChildModule("testModule")?.getDb();
    const conf = await db?.getConfig('dbversion');
    expect(conf?.c_value).not.toBeNull();
  });
})

 describe('Entity', () => {
   let wrapper:undefined|CoreEntityWrapper<TestEntity>=undefined;

   let entity:TestEntity = new TestEntity("Bob",30,"home",new Date());
   let entity2:TestEntity = new TestEntity("Alice",29 );

   test('get wrapper class', async () => {
     const mod=kernel.getChildModule("testModule") as ICoreKernelModule<any, any, any, any, any>;
     const db = mod.getDb() as CoreDBCon<any,any>;
     wrapper=db.getEntityWrapper<TestEntity>("TestEntity")
     expect(wrapper).not.toBeUndefined()
     if (wrapper){
       expect((await wrapper.getObjList()).length).toBe(0)
     }
   });
   test('create new', async () => {
     expect(wrapper).not.toBeUndefined()
     if (wrapper){
       entity= await wrapper.createObject(entity) || entity;
       expect(entity?.e_id).not.toBeNull()
       expect((await wrapper.getObjList()).length).toBe(1)
     }
   });
   test('create new 2', async () => {
     expect(wrapper).not.toBeUndefined()
     if (wrapper){
       entity2=await wrapper.createObject(entity2)||entity2;
       expect(entity2?.e_id).not.toBeNull()
       expect((await wrapper.getObjList()).length).toBe(2)
     }
   });
   test('get by id', async () => {
     expect(wrapper).not.toBeUndefined()
     expect(entity.e_id).not.toBeNull()
     if (wrapper ){
       expect((await wrapper.getObjById(entity.e_id as number))).not.toBeNull()
     }
   });

   test('listing search id', async () => {
     expect(wrapper).not.toBeUndefined()
     if (wrapper){
       expect((await wrapper.getObjList({
         e_id: entity.e_id,
       }))).toHaveLength(1);
     }
   });
   test('listing search version', async () => {
     expect(wrapper).not.toBeUndefined()
     if (wrapper){
       expect((await wrapper.getObjList({
         e_version:0
       }))).toHaveLength(2);
     }
   });
   test('listing search bob', async () => {
     expect(wrapper).not.toBeUndefined()
     if (wrapper){
       expect((await wrapper.getObjList({
         name:"Bob"
       }))).toHaveLength(1);
     }
   });
   test('listing search bob', async () => {
     expect(wrapper).not.toBeUndefined()
     if (wrapper){
       expect((await wrapper.getObjList({
         name:"Bob"
       }))).toHaveLength(1);
     }
   });
   test('listing search bob check date', async () => {
     expect(wrapper).not.toBeUndefined()

     if (wrapper){
       const bonb=await wrapper.getObjList({
         name:"Bob"
       })
       expect(bonb).toHaveLength(1);
       expect(bonb[0].time).not.toBeNull();
     }
   });
   test('listing search version no result', async () => {
     expect(wrapper).not.toBeUndefined()
     if (wrapper){
       expect((await wrapper.getObjList({
         e_version:2
       }))).toHaveLength(0);
     }
   });

   test('find entity', async () => {
     expect(wrapper).not.toBeUndefined()
     if (wrapper){
       expect((await wrapper.findObj({
         e_version:0
       }))).not.toBeNull();
     }
   });
   test('find entity no result', async () => {
     expect(wrapper).not.toBeUndefined()
     if (wrapper){
       expect((await wrapper.findObj({
         e_version:2
       }))).toBeNull();
     }
   });
   test('find entity by id', async () => {
     expect(wrapper).not.toBeUndefined()
     if (wrapper){
       expect((await wrapper.findObj({
         e_id: entity.e_id,
       }))).not.toBeNull();
     }
   });

   test('update', async () => {
     expect(wrapper).not.toBeUndefined()
     expect(entity.e_id).not.toBeNull()
     if (wrapper){
       expect(entity.name).toBe("Bob")
       entity.name="Bobi";
       const update=await wrapper.updateObject(entity);
       expect(update).not.toBeNull()
       expect(update?.name).toBe("Bobi")
       expect((await wrapper.getObjList()).length).toBe(2)
     }
   });
   test('delete', async () => {
     expect(wrapper).not.toBeUndefined()
     if (wrapper){
       expect((await wrapper.delete(entity.e_id as number))).toBeTruthy();
       expect((await wrapper.getObjList()).length).toBe(1)
       expect((await wrapper.delete(entity2.e_id as number))).toBeTruthy();
       expect((await wrapper.getObjList()).length).toBe(0)
     }
   });
 })


describe("ShutDown",()=>{

  test('exit kernel', async () => {
    const result = await kernel.stop();

    await sleep(1000);

    expect(kernel.getState()).toBe('exited');

    expect(result).toBeTruthy();
  });

  test('cleanup', async () => {

    expect(removeFolderIfExist(testPath)).not.toBeFalsy()
  });
})

