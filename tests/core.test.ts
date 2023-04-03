 import {
    CoreModule, JestLib,
    setupDevKernel, TestContext,
    TestKernel, XUtil,
} from '@grandlinex/core';
import PGCon from "../src";

const appName = 'TestKernel';
const appCode = 'tkernel';
 const [testPath] =XUtil.setupEnvironment([__dirname,'..'],['data','config'])
const [kernel] = TestContext.getEntity(
    {
      kernel:new TestKernel(appName, appCode, testPath, __dirname+"/.."),
      cleanUpPath:testPath
    }
);

setupDevKernel(kernel, (mod) => {
  return {
    db: new PGCon(mod, '0'),
    // db: new InMemDB(mod),
  };
});

kernel.setBaseModule(new CoreModule(kernel,(mod)=> new PGCon(mod,"0")))

 JestLib.jestStart();
 JestLib.jestCore();
 JestLib.jestDb();
 JestLib.jestEnd();
 JestLib.jestOrm();
