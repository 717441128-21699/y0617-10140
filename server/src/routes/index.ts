import { Router } from 'express';
import { jobController } from '../controllers/JobController';
import { executionHistoryController } from '../controllers/ExecutionHistoryController';
import { statisticsController } from '../controllers/StatisticsController';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
  });
});

router.get('/jobs/validate-cron', jobController.validateCron.bind(jobController));
router.get('/jobs/preview-executions', jobController.previewNextExecutions.bind(jobController));
router.get('/jobs', jobController.getJobs.bind(jobController));
router.post('/jobs', jobController.createJob.bind(jobController));
router.get('/jobs/:id', jobController.getJob.bind(jobController));
router.put('/jobs/:id', jobController.updateJob.bind(jobController));
router.delete('/jobs/:id', jobController.deleteJob.bind(jobController));
router.post('/jobs/:id/enable', jobController.enableJob.bind(jobController));
router.post('/jobs/:id/disable', jobController.disableJob.bind(jobController));
router.post('/jobs/:id/trigger', jobController.triggerJob.bind(jobController));

router.get('/execution-history', executionHistoryController.getHistory.bind(executionHistoryController));
router.get('/execution-history/:id', executionHistoryController.getHistoryById.bind(executionHistoryController));
router.delete('/execution-history/:id', executionHistoryController.deleteHistory.bind(executionHistoryController));
router.delete('/execution-history', executionHistoryController.clearOldHistory.bind(executionHistoryController));

router.get('/statistics', statisticsController.getStatistics.bind(statisticsController));
router.get('/statistics/jobs/:jobId', statisticsController.getJobStatistics.bind(statisticsController));

export default router;
