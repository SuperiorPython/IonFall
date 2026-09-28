using UnityEngine;

/// <summary>
/// Moves the enemy toward the Dome, attacks in range, and retreats off-screen
/// the moment Day begins (regardless of what it was doing), where it despawns
/// once it leaves the play area. Straight-line movement is intentional for the
/// demo — NavMesh/pathfinding can be added later if obstacles are introduced.
/// Attach to the enemy prefab, alongside EnemyHealth.
/// </summary>
public class EnemyAI : MonoBehaviour
{
    private enum State { Approaching, Attacking, Retreating }

    [Header("Movement")]
    [SerializeField] private float moveSpeed = 2f;
    [SerializeField] private float attackRange = 1.2f;
    [SerializeField] private float retreatSpeed = 4f; // usually faster than approach, reads as "fleeing"

    [Header("Attack")]
    [SerializeField] private float damagePerHit = 5f;
    [SerializeField] private float attackInterval = 1f;

    [Header("References")]
    [SerializeField] private DayNightManager dayNightManager;
    [SerializeField] private PlayAreaBounds playAreaBounds; // optional — leave empty to disable the despawn check

    private Transform domeTransform;
    private DomeHealth domeHealth;
    private float attackTimer;
    private State currentState = State.Approaching;

    private void Start()
    {
        // Simple lookup — fine for a single dome. If multiple targets are ever
        // added, this should be replaced with a proper target-selection system.
        var domeObj = GameObject.FindGameObjectWithTag("Dome");
        if (domeObj != null)
        {
            domeTransform = domeObj.transform;
            domeHealth = domeObj.GetComponent<DomeHealth>();
        }
        else
        {
            Debug.LogWarning("EnemyAI could not find an object tagged 'Dome'. " +
                              "Make sure the Dome GameObject has the 'Dome' tag assigned.");
        }
    }

    private void OnEnable()
    {
        // Prefab-instantiated objects often can't hold a scene reference assigned
        // in the Inspector — fall back to finding it at runtime so this always works.
        if (dayNightManager == null)
        {
            dayNightManager = FindObjectOfType<DayNightManager>();
        }

        if (dayNightManager != null)
        {
            dayNightManager.OnDayStarted += HandleDayStarted;
        }
        else
        {
            Debug.LogWarning("EnemyAI could not find a DayNightManager in the scene — this enemy will never retreat at day.");
        }
    }

    private void OnDisable()
    {
        if (dayNightManager != null)
        {
            dayNightManager.OnDayStarted -= HandleDayStarted;
        }
    }

    private void HandleDayStarted(int day)
    {
        // Override whatever this enemy was doing — day means retreat, no exceptions.
        currentState = State.Retreating;
    }

    private void Update()
    {
        switch (currentState)
        {
            case State.Approaching:
                UpdateApproaching();
                break;
            case State.Attacking:
                UpdateAttacking();
                break;
            case State.Retreating:
                UpdateRetreating();
                break;
        }
    }

    private void UpdateApproaching()
    {
        if (domeTransform == null) return;

        float distance = Vector2.Distance(transform.position, domeTransform.position);
        if (distance <= attackRange)
        {
            currentState = State.Attacking;
            return;
        }

        Vector2 direction = (domeTransform.position - transform.position).normalized;
        transform.Translate(direction * moveSpeed * Time.deltaTime, Space.World);
    }

    private void UpdateAttacking()
    {
        if (domeTransform == null) return;

        attackTimer -= Time.deltaTime;
        if (attackTimer <= 0f)
        {
            domeHealth?.TakeDamage(damagePerHit);
            attackTimer = attackInterval;
        }
    }

    private void UpdateRetreating()
    {
        // Flee straight away from the dome. If we never had a dome reference,
        // just pick a fixed outward direction so the enemy still leaves.
        Vector2 fleeDirection = domeTransform != null
            ? ((Vector2)transform.position - (Vector2)domeTransform.position).normalized
            : Vector2.up;

        if (fleeDirection == Vector2.zero) fleeDirection = Vector2.up; // guard against standing exactly on the dome

        transform.Translate(fleeDirection * retreatSpeed * Time.deltaTime, Space.World);

        if (playAreaBounds != null && playAreaBounds.IsOutside(transform.position))
        {
            Destroy(gameObject);
        }
    }
}
