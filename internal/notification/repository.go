package notification

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Repository interface {
	ListChannels(projectID string, channelType ChannelType) ([]Channel, error)
	CreateChannel(ch *Channel) error
	DeleteChannel(id, projectID string) error

	CreateDelivery(d *Delivery) error
	ListDeliveries(channelID string, limit int) ([]Delivery, error)
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) ListChannels(projectID string, channelType ChannelType) ([]Channel, error) {
	var channels []Channel
	q := r.db.Where("project_id = ? AND active = TRUE", projectID)
	if channelType != "" {
		q = q.Where("type = ?", channelType)
	}
	err := q.Order("created_at ASC").Find(&channels).Error
	return channels, err
}

func (r *repository) CreateChannel(ch *Channel) error {
	if ch.ID == "" {
		ch.ID = uuid.New().String()
	}
	if ch.CreatedAt.IsZero() {
		ch.CreatedAt = time.Now()
	}
	return r.db.Create(ch).Error
}

func (r *repository) DeleteChannel(id, projectID string) error {
	return r.db.Model(&Channel{}).
		Where("id = ? AND project_id = ?", id, projectID).
		Update("active", false).Error
}

func (r *repository) CreateDelivery(d *Delivery) error {
	if d.ID == "" {
		d.ID = uuid.New().String()
	}
	if d.DeliveredAt.IsZero() {
		d.DeliveredAt = time.Now()
	}
	return r.db.Create(d).Error
}

func (r *repository) ListDeliveries(channelID string, limit int) ([]Delivery, error) {
	var deliveries []Delivery
	err := r.db.Where("channel_id = ?", channelID).
		Order("delivered_at DESC").
		Limit(limit).
		Find(&deliveries).Error
	return deliveries, err
}
