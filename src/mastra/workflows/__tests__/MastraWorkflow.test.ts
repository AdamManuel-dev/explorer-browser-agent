import { MastraWorkflow, createWorkflow, createStep, WorkflowContext } from '../MastraWorkflow';

describe('MastraWorkflow', () => {
  describe('Basic Workflow Execution', () => {
    it('should execute a simple workflow successfully', async () => {
      const workflow = new MastraWorkflow(
        createWorkflow({
          name: 'Test Workflow',
          version: '1.0.0',
          steps: [
            createStep({
              name: 'Step 1',
              handler: async (input: number) => input * 2,
            }),
            createStep({
              name: 'Step 2',
              handler: async (input: number) => input + 10,
            }),
          ],
        })
      );

      const result = await workflow.execute(5);

      expect(result.status).toBe('completed');
      expect(result.output).toBe(20); // (5 * 2) + 10
      expect(result.stepResults.size).toBe(2);
    });

    it('should handle workflow errors properly', async () => {
      const workflow = new MastraWorkflow(
        createWorkflow({
          name: 'Error Workflow',
          version: '1.0.0',
          steps: [
            createStep({
              name: 'Failing Step',
              handler: async () => {
                throw new Error('Step failed');
              },
            }),
          ],
        })
      );

      await expect(workflow.execute(null)).rejects.toThrow('Step failed');
    });
  });

  describe('Step Conditions', () => {
    it('should skip steps when condition is false', async () => {
      let step2Executed = false;

      const workflow = new MastraWorkflow(
        createWorkflow({
          name: 'Conditional Workflow',
          version: '1.0.0',
          steps: [
            createStep({
              name: 'Step 1',
              handler: async () => ({ skip: true }),
            }),
            createStep({
              name: 'Step 2',
              condition: (context: WorkflowContext) => {
                const step1Result = context.state.get('step_1');
                return !step1Result?.skip;
              },
              handler: async () => {
                step2Executed = true;
                return 'executed';
              },
            }),
          ],
        })
      );

      const result = await workflow.execute(null);

      expect(result.status).toBe('completed');
      expect(step2Executed).toBe(false);
      expect(result.stepResults.get('step_2')?.status).toBe('skipped');
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed steps according to retry policy', async () => {
      let attempts = 0;

      const workflow = new MastraWorkflow(
        createWorkflow({
          name: 'Retry Workflow',
          version: '1.0.0',
          steps: [
            createStep({
              name: 'Retry Step',
              handler: async () => {
                attempts++;
                if (attempts < 3) {
                  throw new Error('Temporary failure');
                }
                return 'success';
              },
              retryPolicy: {
                maxAttempts: 3,
                delayMs: 10,
              },
            }),
          ],
        })
      );

      const result = await workflow.execute(null);

      expect(result.status).toBe('completed');
      expect(result.output).toBe('success');
      expect(attempts).toBe(3);
      expect(result.stepResults.get('retry_step')?.attempts).toBe(3);
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout long-running steps', async () => {
      const workflow = new MastraWorkflow(
        createWorkflow({
          name: 'Timeout Workflow',
          version: '1.0.0',
          steps: [
            createStep({
              name: 'Slow Step',
              handler: async () => {
                await new Promise((resolve) => setTimeout(resolve, 1000));
                return 'completed';
              },
              timeout: 100, // 100ms timeout
            }),
          ],
        })
      );

      await expect(workflow.execute(null)).rejects.toThrow('Operation timed out');
    });
  });

  describe('Context Management', () => {
    it('should pass context between steps', async () => {
      const workflow = new MastraWorkflow(
        createWorkflow({
          name: 'Context Workflow',
          version: '1.0.0',
          steps: [
            createStep({
              name: 'Set Context',
              handler: async (_, context: WorkflowContext) => {
                context.metadata.set('key', 'value');
                return { data: 'test' };
              },
            }),
            createStep({
              name: 'Read Context',
              handler: async (input: any, context: WorkflowContext) => {
                return {
                  previousOutput: input,
                  metadata: context.metadata.get('key'),
                  step1Result: context.state.get('set_context'),
                };
              },
            }),
          ],
        })
      );

      const result = await workflow.execute('initial');

      expect(result.status).toBe('completed');
      expect(result.output).toEqual({
        previousOutput: { data: 'test' },
        metadata: 'value',
        step1Result: { data: 'test' },
      });
    });
  });

  describe('Event Handling', () => {
    it('should emit workflow lifecycle events', async () => {
      const events: string[] = [];

      const workflow = new MastraWorkflow(
        createWorkflow({
          name: 'Event Workflow',
          version: '1.0.0',
          steps: [
            createStep({
              name: 'Step 1',
              handler: async () => 'done',
            }),
          ],
        })
      );

      workflow.on('workflow:started', () => events.push('workflow:started'));
      workflow.on('workflow:completed', () => events.push('workflow:completed'));
      workflow.on('step:started', () => events.push('step:started'));
      workflow.on('step:completed', () => events.push('step:completed'));

      await workflow.execute(null);

      expect(events).toEqual([
        'workflow:started',
        'step:started',
        'step:completed',
        'workflow:completed',
      ]);
    });
  });

  describe('Error Handlers', () => {
    it('should execute step error handlers', async () => {
      let errorHandled = false;

      const workflow = new MastraWorkflow(
        createWorkflow({
          name: 'Error Handler Workflow',
          version: '1.0.0',
          steps: [
            createStep({
              name: 'Failing Step',
              handler: async () => {
                throw new Error('Step error');
              },
              onError: async (error) => {
                errorHandled = true;
                expect(error.message).toBe('Step error');
              },
            }),
          ],
        })
      );

      const result = await workflow.execute(null);
      expect(result.status).toBe('completed'); // Workflow completes despite step error because of error handler
      expect(errorHandled).toBe(true);
      expect(result.stepResults.get('failing_step')?.status).toBe('failed');
    });

    it('should execute workflow error handler', async () => {
      let workflowErrorHandled = false;

      const workflow = new MastraWorkflow(
        createWorkflow({
          name: 'Workflow Error Handler',
          version: '1.0.0',
          steps: [
            createStep({
              name: 'Failing Step',
              handler: async () => {
                throw new Error('Critical error');
              },
            }),
          ],
          onError: async (error) => {
            workflowErrorHandled = true;
            expect(error.message).toBe('Critical error');
          },
        })
      );

      await expect(workflow.execute(null)).rejects.toThrow('Critical error');
      expect(workflowErrorHandled).toBe(true);
    });
  });

  describe('Workflow Hooks', () => {
    it('should execute onStart and onComplete hooks', async () => {
      const hooks: string[] = [];

      const workflow = new MastraWorkflow(
        createWorkflow({
          name: 'Hook Workflow',
          version: '1.0.0',
          steps: [
            createStep({
              name: 'Main Step',
              handler: async () => {
                hooks.push('step');
                return 'result';
              },
            }),
          ],
          onStart: async () => {
            hooks.push('onStart');
          },
          onComplete: async () => {
            hooks.push('onComplete');
          },
        })
      );

      const result = await workflow.execute(null);

      expect(result.status).toBe('completed');
      expect(hooks).toEqual(['onStart', 'step', 'onComplete']);
    });
  });

  describe('Cancellation', () => {
    it('should cancel running workflows', async () => {
      const workflow = new MastraWorkflow(
        createWorkflow({
          name: 'Cancellable Workflow',
          version: '1.0.0',
          steps: [
            createStep({
              name: 'Long Step',
              handler: async () => {
                await new Promise((resolve) => setTimeout(resolve, 200));
                return 'completed';
              },
            }),
          ],
        })
      );

      // Start workflow without awaiting
      const executionPromise = workflow.execute(null);
      
      // Wait a bit to ensure workflow is running
      await new Promise((resolve) => setTimeout(resolve, 50));
      
      // Get execution status before cancellation
      const executionId = Array.from((workflow as any).activeExecutions.keys())[0] as string;
      expect(workflow.getExecutionStatus(executionId).exists).toBe(true);
      
      // Cancel the workflow
      const cancelled = await workflow.cancel(executionId);
      expect(cancelled).toBe(true);
      
      // Verify it's no longer active
      expect(workflow.getExecutionStatus(executionId).exists).toBe(false);
      
      // The workflow should still complete since we don't have true interruption
      const result = await executionPromise;
      expect(result.status).toBe('completed');
    });
  });
});