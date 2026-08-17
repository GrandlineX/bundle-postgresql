import {CoreModule} from '@grandlinex/core';
import { TestLib, setupDevKernel, TestContext, TestKernel,} from '@grandlinex/core/dev';
import { PGCon } from '../src/index.js';

const appName = 'TestKernel';
const appCode = 'tkernel';
const [kernel] = TestContext.getEntity(
    {
      kernel:new TestKernel(appName, appCode, __dirname),
      cleanUp:true
    }
);

setupDevKernel(kernel, (mod) => {
  return {
    db: new PGCon(mod, '0'),
    // db: new InMemDB(mod),
  };
});

kernel.setBaseModule(new CoreModule(kernel,(mod)=> new PGCon(mod,"0")))
TestLib.testStart();
TestLib.testCore();
TestLib.testDb();
TestLib.testEnd();
TestLib.testOrm();
