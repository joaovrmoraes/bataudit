package worker

import (
	"context"
	"log/slog"
	"math"
	"sync"
	"time"
)

// scaleWorkers adjusts the number of active workers to the target count
func (s *Service) scaleWorkers(ctx context.Context, wg *sync.WaitGroup, targetWorkerCount int) {
	s.workerMutex.Lock()
	defer s.workerMutex.Unlock()

	if targetWorkerCount < s.config.MinWorkerCount {
		targetWorkerCount = s.config.MinWorkerCount
	}
	if targetWorkerCount > s.config.MaxWorkerCount {
		targetWorkerCount = s.config.MaxWorkerCount
	}

	if targetWorkerCount == s.activeWorkers {
		return
	}

	if targetWorkerCount > s.activeWorkers {
		s.scaleUp(ctx, wg, targetWorkerCount)
		return
	}

	s.scaleDown(targetWorkerCount)
}

// scaleUp launches new workers up to targetCount
func (s *Service) scaleUp(ctx context.Context, wg *sync.WaitGroup, targetCount int) {
	slog.Info("Scaling up", "from", s.activeWorkers, "to", targetCount)

	nextWorkerID := 0
	for id := range s.workerChannels {
		if id >= nextWorkerID {
			nextWorkerID = id + 1
		}
	}

	for i := s.activeWorkers; i < targetCount; i++ {
		stopChan := make(chan bool, 1)
		s.workerChannels[nextWorkerID] = stopChan

		wg.Add(1)
		go s.runWorkerWithControl(ctx, nextWorkerID, wg, stopChan)

		nextWorkerID++
		s.activeWorkers++
	}

	s.lastScaleTime = time.Now()
}

// scaleDown stops workers down to targetCount
func (s *Service) scaleDown(targetCount int) {
	if s.activeWorkers <= s.config.MinWorkerCount {
		return
	}

	slog.Info("Scaling down", "from", s.activeWorkers, "to", targetCount)

	workersToRemove := s.activeWorkers - targetCount

	workersToStop := make([]int, 0, workersToRemove)
	for id := range s.workerChannels {
		workersToStop = append(workersToStop, id)
		if len(workersToStop) >= workersToRemove {
			break
		}
	}

	for _, id := range workersToStop {
		s.workerChannels[id] <- true
		close(s.workerChannels[id])
		delete(s.workerChannels, id)
	}

	s.activeWorkers -= workersToRemove
	s.lastScaleTime = time.Now()
}

// evaluateScaling evaluates the need for scaling based on queue metrics
func (s *Service) evaluateScaling(ctx context.Context, wg *sync.WaitGroup, queueSize int64) {
	s.workerMutex.Lock()
	currentWorkers := s.activeWorkers
	s.workerMutex.Unlock()

	slog.Debug("Evaluating scaling",
		"queue_size", queueSize,
		"current_workers", currentWorkers,
		"threshold", s.config.ScaleUpThreshold,
	)

	if queueSize > s.config.ScaleUpThreshold && currentWorkers < s.config.MaxWorkerCount {
		var workersNeeded int

		if queueSize > s.config.ScaleUpThreshold*5 {
			workersNeeded = s.config.MaxWorkerCount
			slog.Warn("Queue exceeds 5x threshold, scaling to max", "workers", workersNeeded)
		} else if queueSize > s.config.ScaleUpThreshold*3 {
			workersNeeded = int(math.Ceil(float64(currentWorkers) * s.config.WorkerScaleFactor * 1.5))
			slog.Info("Queue exceeds 3x threshold, aggressive scaling", "workers", workersNeeded)
		} else {
			workersNeeded = int(math.Ceil(float64(currentWorkers) * s.config.WorkerScaleFactor))
			slog.Info("Normal scale up", "workers", workersNeeded)
		}

		if workersNeeded > s.config.MaxWorkerCount {
			workersNeeded = s.config.MaxWorkerCount
		}
		if workersNeeded <= currentWorkers {
			workersNeeded = currentWorkers + 1
		}

		s.scaleWorkers(ctx, wg, workersNeeded)
		return
	}

	if queueSize < s.config.ScaleDownThreshold && currentWorkers > s.config.MinWorkerCount {
		workersNeeded := int(math.Floor(float64(currentWorkers) / s.config.WorkerScaleFactor))
		if workersNeeded < s.config.MinWorkerCount {
			workersNeeded = s.config.MinWorkerCount
		}
		if workersNeeded < currentWorkers {
			s.scaleWorkers(ctx, wg, workersNeeded)
		}
	}
}
