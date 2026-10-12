from datetime import date, datetime
from typing import Optional, List
from sqlalchemy import String, Integer, Boolean, Date, DateTime, ForeignKey, UniqueConstraint, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

class Base(DeclarativeBase):
    pass

# ==========================================
# TENANT CONFIGURATION
# ==========================================

class Trust(Base):
    """Represents an NHS Trust (Tenant)."""
    __tablename__ = "trusts"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True)
    group_name: Mapped[Optional[str]] = mapped_column(String(255)) # Used for group-level access

    assessments: Mapped[List["Assessment"]] = relationship(back_populates="trust")
    users: Mapped[List["User"]] = relationship(back_populates="trust")

class User(Base):
    """System users with credentials and role-based access."""
    __tablename__ = "users"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(50), default="reviewer") # "admin", "group_lead", "reviewer"
    trust_id: Mapped[Optional[int]] = mapped_column(ForeignKey("trusts.id"))
    
    trust: Mapped[Optional["Trust"]] = relationship(back_populates="users")

# ==========================================
# GLOBAL REFERENCE DATA (Shared across Trusts)
# ==========================================

class Guideline(Base):
    """A NICE Guideline, centrally managed and shared across all Trusts."""
    __tablename__ = "guidelines"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    nice_id: Mapped[str] = mapped_column(String(50), unique=True) # e.g., "NG159"
    name: Mapped[str] = mapped_column(String(500))
    
    recommendations: Mapped[List["Recommendation"]] = relationship(back_populates="guideline")

class RecommendationHistory(Base):
    """Audit trail for when NICE updates the text of an existing recommendation."""
    __tablename__ = "recommendation_history"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    recommendation_id: Mapped[int] = mapped_column(ForeignKey("recommendations.id"))
    old_text: Mapped[str] = mapped_column(Text)
    changed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Recommendation(Base):
    """A specific recommendation from a NICE Guideline. Centrally managed."""
    __tablename__ = "recommendations"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    guideline_id: Mapped[int] = mapped_column(ForeignKey("guidelines.id"))
    guideline_rec: Mapped[str] = mapped_column(String(50)) # e.g., "1.1.1"
    rec_text: Mapped[str] = mapped_column(Text)
    rec_year: Mapped[Optional[int]] = mapped_column(Integer) # Legacy
    publish_info: Mapped[Optional[str]] = mapped_column(String(200)) # New flexible text column

    guideline: Mapped["Guideline"] = relationship(back_populates="recommendations")
    assessments: Mapped[List["Assessment"]] = relationship(back_populates="recommendation")
    history: Mapped[List["RecommendationHistory"]] = relationship()

# ==========================================
# TENANT DATA (Strictly Isolated)
# ==========================================

class ActionUpdate(Base):
    """A dated progress update for an action."""
    __tablename__ = "action_updates"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    assessment_id: Mapped[int] = mapped_column(ForeignKey("assessments.id"))
    update_text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    assessment: Mapped["Assessment"] = relationship(back_populates="updates")


class Assessment(Base):
    """A specific Trust's answers to a specific recommendation."""
    __tablename__ = "assessments"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    trust_id: Mapped[int] = mapped_column(ForeignKey("trusts.id"))
    recommendation_id: Mapped[int] = mapped_column(ForeignKey("recommendations.id"))
    
    # The Assessment Form Answers
    relevant: Mapped[Optional[bool]] = mapped_column(Boolean)
    meet: Mapped[Optional[str]] = mapped_column(String(50)) # 'Yes', 'No', 'Partial'
    evidence: Mapped[Optional[str]] = mapped_column(Text)
    action: Mapped[Optional[str]] = mapped_column(Text)
    action_status: Mapped[Optional[str]] = mapped_column(String(50), default="Not Started")
    risk: Mapped[Optional[str]] = mapped_column(String(50))
    cost: Mapped[Optional[str]] = mapped_column(String(50))
    capacity: Mapped[Optional[str]] = mapped_column(String(50))
    deadline: Mapped[Optional[date]] = mapped_column(Date)
    lead: Mapped[Optional[str]] = mapped_column(String(255))
    completed_by: Mapped[Optional[str]] = mapped_column(String(255))

    trust: Mapped["Trust"] = relationship(back_populates="assessments")
    recommendation: Mapped["Recommendation"] = relationship(back_populates="assessments")
    
    # Relationship to Action Updates
    updates: Mapped[List["ActionUpdate"]] = relationship(back_populates="assessment", order_by="ActionUpdate.created_at.desc()")

    __table_args__ = (
        # CRITICAL BUSINESS RULE: A Trust can only have one assessment per recommendation
        UniqueConstraint("trust_id", "recommendation_id", name="uq_trust_recommendation"),
    )

class GuidelineAssignment(Base):
    """Tracks assignment of a guideline to a reviewer within a Trust."""
    __tablename__ = "guideline_assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    trust_id: Mapped[int] = mapped_column(ForeignKey("trusts.id"))
    guideline_id: Mapped[int] = mapped_column(ForeignKey("guidelines.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(50), default="Assigned") # "Assigned", "In Progress", "Completed"
    assigned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    notes: Mapped[Optional[str]] = mapped_column(String(500))

    user: Mapped["User"] = relationship()
    guideline: Mapped["Guideline"] = relationship()
    trust: Mapped["Trust"] = relationship()

