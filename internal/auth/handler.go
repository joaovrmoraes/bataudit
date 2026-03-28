package auth

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// RegisterPublicRoutes registers unauthenticated auth endpoints.
func (h *Handler) RegisterPublicRoutes(router *gin.RouterGroup) {
	router.POST("/login", h.Login)
}

// RegisterProtectedRoutes registers endpoints that require a valid JWT.
func (h *Handler) RegisterProtectedRoutes(router *gin.RouterGroup) {
	router.POST("/logout", h.Logout)
	router.GET("/me", h.Me)
	router.GET("/projects", h.ListProjects)
	router.POST("/projects", h.CreateProject)
	router.GET("/projects/:id/members", h.ListMembers)
	router.POST("/projects/:id/members", h.AddMember)
	router.PATCH("/projects/:id/members/:userId", h.UpdateMemberRole)
	router.DELETE("/projects/:id/members/:userId", h.RemoveMember)
	router.GET("/api-keys", h.ListAPIKeys)
	router.POST("/api-keys", h.CreateAPIKey)
	router.DELETE("/api-keys/:id", h.RevokeAPIKey)
}

// --- Auth ---

// Logout godoc
// @Summary      Logout
// @Description  Invalidates the current session (client should discard the token)
// @Tags         auth
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  map[string]string
// @Router       /auth/logout [post]
func (h *Handler) Logout(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "logged out"})
}

type loginRequest struct {
	Email    string `json:"email"    binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// Login godoc
// @Summary      Login
// @Description  Authenticates a user and returns a JWT token
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        body  body      loginRequest  true  "Credentials"
// @Success      200   {object}  map[string]interface{}
// @Failure      400   {object}  map[string]string
// @Failure      401   {object}  map[string]string
// @Router       /auth/login [post]
func (h *Handler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	token, user, err := h.service.Login(req.Email, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user": gin.H{
			"id":    user.ID,
			"name":  user.Name,
			"email": user.Email,
			"role":  user.Role,
		},
	})
}

// Me godoc
// @Summary      Current user
// @Description  Returns the authenticated user's info from the JWT
// @Tags         auth
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  map[string]interface{}
// @Failure      401  {object}  map[string]string
// @Router       /auth/me [get]
func (h *Handler) Me(c *gin.Context) {
	claims, _ := c.Get(ContextKeyClaims)
	userClaims := claims.(*Claims)

	c.JSON(http.StatusOK, gin.H{
		"id":    userClaims.UserID,
		"email": userClaims.Email,
		"role":  userClaims.Role,
	})
}

// --- Projects ---

// ListProjects godoc
// @Summary      List projects
// @Description  Returns all projects the current user has access to. Owner sees all projects.
// @Tags         projects
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  map[string]interface{}
// @Failure      401  {object}  map[string]string
// @Router       /auth/projects [get]
func (h *Handler) ListProjects(c *gin.Context) {
	claims := c.MustGet(ContextKeyClaims).(*Claims)

	var projects []Project
	var err error

	if claims.Role == RoleOwner {
		projects, err = h.service.repo.ListAllProjects()
	} else {
		projects, err = h.service.repo.ListProjectsByUser(claims.UserID)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list projects"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": projects})
}

type createProjectRequest struct {
	Name string `json:"name" binding:"required,min=1,max=128"`
	Slug string `json:"slug" binding:"required,min=1,max=128"`
}

// CreateProject godoc
// @Summary      Create project
// @Description  Creates a new project
// @Tags         projects
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body  body      createProjectRequest  true  "Project data"
// @Success      201   {object}  Project
// @Failure      400   {object}  map[string]string
// @Failure      409   {object}  map[string]string
// @Router       /auth/projects [post]
func (h *Handler) CreateProject(c *gin.Context) {
	claims := c.MustGet(ContextKeyClaims).(*Claims)

	var req createProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	project := &Project{
		ID:        uuid.New().String(),
		Name:      req.Name,
		Slug:      req.Slug,
		CreatedBy: claims.UserID,
		CreatedAt: time.Now(),
	}

	if err := h.service.repo.CreateProject(project); err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "a project with this slug already exists"})
		return
	}

	// Add creator as owner of the project
	_ = h.service.repo.CreateProjectMember(&ProjectMember{
		UserID:    claims.UserID,
		ProjectID: project.ID,
		Role:      RoleOwner,
	})

	c.JSON(http.StatusCreated, project)
}

// --- Members ---

// ListMembers godoc
// @Summary      List project members
// @Description  Returns all members of a project
// @Tags         members
// @Produce      json
// @Security     BearerAuth
// @Param        id   path      string  true  "Project ID"
// @Success      200  {object}  map[string]interface{}
// @Failure      401  {object}  map[string]string
// @Router       /auth/projects/{id}/members [get]
func (h *Handler) ListMembers(c *gin.Context) {
	projectID := c.Param("id")
	members, err := h.service.repo.ListMembersByProject(projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list members"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": members})
}

type addMemberRequest struct {
	Email string   `json:"email" binding:"required,email"`
	Role  UserRole `json:"role"  binding:"required"`
}

// AddMember godoc
// @Summary      Add project member
// @Description  Adds a user (by email) to a project with the specified role
// @Tags         members
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id    path      string           true  "Project ID"
// @Param        body  body      addMemberRequest true  "Member data"
// @Success      201   {object}  map[string]string
// @Failure      400   {object}  map[string]string
// @Failure      404   {object}  map[string]string
// @Failure      409   {object}  map[string]string
// @Router       /auth/projects/{id}/members [post]
func (h *Handler) AddMember(c *gin.Context) {
	projectID := c.Param("id")

	var req addMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.service.repo.GetUserByEmail(req.Email)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	member := &ProjectMember{
		UserID:    user.ID,
		ProjectID: projectID,
		Role:      req.Role,
	}
	if err := h.service.repo.CreateProjectMember(member); err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "user is already a member of this project"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "member added"})
}

type updateMemberRoleRequest struct {
	Role UserRole `json:"role" binding:"required"`
}

// UpdateMemberRole godoc
// @Summary      Update member role
// @Description  Changes the role of an existing project member
// @Tags         members
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id      path      string                   true  "Project ID"
// @Param        userId  path      string                   true  "User ID"
// @Param        body    body      updateMemberRoleRequest  true  "New role"
// @Success      200     {object}  map[string]string
// @Failure      400     {object}  map[string]string
// @Router       /auth/projects/{id}/members/{userId} [patch]
func (h *Handler) UpdateMemberRole(c *gin.Context) {
	projectID := c.Param("id")
	userID := c.Param("userId")

	var req updateMemberRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.repo.UpdateProjectMemberRole(userID, projectID, req.Role); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update member role"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "role updated"})
}

// RemoveMember godoc
// @Summary      Remove project member
// @Description  Removes a user from a project
// @Tags         members
// @Produce      json
// @Security     BearerAuth
// @Param        id      path      string  true  "Project ID"
// @Param        userId  path      string  true  "User ID"
// @Success      200     {object}  map[string]string
// @Failure      500     {object}  map[string]string
// @Router       /auth/projects/{id}/members/{userId} [delete]
func (h *Handler) RemoveMember(c *gin.Context) {
	projectID := c.Param("id")
	userID := c.Param("userId")

	if err := h.service.repo.DeleteProjectMember(userID, projectID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to remove member"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "member removed"})
}

// --- API Keys ---

// ListAPIKeys godoc
// @Summary      List API keys
// @Description  Returns all API keys for a project
// @Tags         api-keys
// @Produce      json
// @Security     BearerAuth
// @Param        project_id  query     string  true  "Project ID"
// @Success      200         {object}  map[string]interface{}
// @Failure      400         {object}  map[string]string
// @Router       /auth/api-keys [get]
func (h *Handler) ListAPIKeys(c *gin.Context) {
	projectID := c.Query("project_id")
	if projectID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "project_id is required"})
		return
	}

	keys, err := h.service.repo.ListAPIKeysByProject(projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list api keys"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": keys})
}

type createAPIKeyRequest struct {
	ProjectID string `json:"project_id" binding:"required"`
	Name      string `json:"name"       binding:"required,min=1,max=128"`
}

// CreateAPIKey godoc
// @Summary      Create API key
// @Description  Generates a new API key for a project. The raw key is shown only once.
// @Tags         api-keys
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body  body      createAPIKeyRequest  true  "API key data"
// @Success      201   {object}  map[string]string
// @Failure      400   {object}  map[string]string
// @Router       /auth/api-keys [post]
func (h *Handler) CreateAPIKey(c *gin.Context) {
	var req createAPIKeyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	rawKey, err := h.service.CreateAPIKey(req.ProjectID, req.Name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create api key"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"key":  rawKey,
		"note": "Store this key safely — it will not be shown again.",
	})
}

// RevokeAPIKey godoc
// @Summary      Revoke API key
// @Description  Marks an API key as inactive — it will no longer be accepted by the Writer
// @Tags         api-keys
// @Produce      json
// @Security     BearerAuth
// @Param        id   path      string  true  "API Key ID"
// @Success      200  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /auth/api-keys/{id} [delete]
func (h *Handler) RevokeAPIKey(c *gin.Context) {
	id := c.Param("id")
	if err := h.service.repo.RevokeAPIKey(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to revoke api key"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "api key revoked"})
}
