package worker

import (
	"context"
	"fmt"
	"math"
	"sync"
	"time"
)

// scaleWorkers - adjust the number of active workers to the target count
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

	if targetWorkerCount < s.activeWorkers {
		s.scaleDown(targetWorkerCount)
		return
	}
}

// scaleUp - scale up the number of workers
func (s *Service) scaleUp(ctx context.Context, wg *sync.WaitGroup, targetCount int) {
	fmt.Printf("[Autoscale] Scaling up from %d to %d workers\n", s.activeWorkers, targetCount)

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

// scaleDown - reduce the number of workers
func (s *Service) scaleDown(targetCount int) {
	if s.activeWorkers <= s.config.MinWorkerCount {
		return
	}

	fmt.Printf("[Autoscale] Scaling down from %d to %d workers\n", s.activeWorkers, targetCount)

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

// evaluateScaling - evaluate the need for scaling based on metrics
func (s *Service) evaluateScaling(ctx context.Context, wg *sync.WaitGroup, queueSize int64) {
	s.workerMutex.Lock()
	currentWorkers := s.activeWorkers
	s.workerMutex.Unlock()

	fmt.Printf("[Autoscale] Evaluating scaling: Queue size %d, Current workers: %d, Threshold: %d\n",
		queueSize, currentWorkers, s.config.ScaleUpThreshold)

	if queueSize > s.config.ScaleUpThreshold && currentWorkers < s.config.MaxWorkerCount {
		var workersNeeded int

		if queueSize > s.config.ScaleUpThreshold*5 {
			workersNeeded = s.config.MaxWorkerCount
			fmt.Printf("[Autoscale] Queue exceeds 5x threshold, scaling to maximum: %d workers\n", workersNeeded)
		} else if queueSize > s.config.ScaleUpThreshold*3 {
			workersNeeded = int(math.Ceil(float64(currentWorkers) * s.config.WorkerScaleFactor * 1.5))
			fmt.Printf("[Autoscale] Queue exceeds 3x threshold, aggressive scaling to %d workers\n", workersNeeded)
		} else {
			workersNeeded = int(math.Ceil(float64(currentWorkers) * s.config.WorkerScaleFactor))
			fmt.Printf("[Autoscale] Normal scaling to %d workers\n", workersNeeded)
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
