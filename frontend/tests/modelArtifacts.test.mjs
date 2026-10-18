import test from 'node:test';
import assert from 'node:assert/strict';
import artifact from '../../ml/outputs/model_evaluation_artifacts.json' with { type: 'json' };
import cutoff from '../../ml/outputs/threshold_tuning_results.json' with { type: 'json' };
import { TRAINED_MODEL_RESULTS } from '../src/config/index.ts';

test('published chart values and rankings stay tied to the recorded artifact', () => {
  const { champion, models } = TRAINED_MODEL_RESULTS;
  const cm = champion.confusionMatrix;
  assert.equal(cm.tn + cm.fp + cm.fn + cm.tp, artifact.dataset.test_size);
  assert.ok(Math.abs((cm.tn + cm.tp) / artifact.dataset.test_size * 100 - champion.metrics.accuracy) < 0.01);
  assert.equal(models.length, artifact.benchmark_comparison.length);
  assert.equal(champion.topFeatures[0].name, 'backlog risk ratio');
  assert.equal(champion.topFeatures[0].importance, artifact.champion_model.feature_importances[0].importance);
  assert.deepEqual(champion.rocPoints, artifact.champion_model.roc_points);
  assert.equal(champion.rocPoints.length, 101);
  assert.equal(champion.cutoffTuning.highRecallCutoff.threshold, cutoff.high_recall_cutoff.threshold);
});
