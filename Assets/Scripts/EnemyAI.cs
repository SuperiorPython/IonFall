using UnityEngine;

/// <summary>
/// Moves the enemy in a straight line toward the Dome, stops within attack range,
/// and deals periodic damage to it. Straight-line movement is intentional for the
/// demo — NavMesh/pathfinding can be added later if obstacles are introduced.
/// Attach to the enemy prefab, alongside EnemyHealth.
/// </summary>
public class EnemyAI : MonoBehaviour
{
    [Header("Movement")]
    [SerializeField] private float moveSpeed = 2f;
    [SerializeField] private float attackRange = 1.2f;

    [Header("Attack")]
    [SerializeField] private float damagePerHit = 5f;
    [SerializeField] private float attackInterval = 1f;

    private Transform domeTransform;
    private DomeHealth domeHealth;
    private float attackTimer;

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

    private void Update()
    {
        if (domeTransform == null) return;

        float distance = Vector2.Distance(transform.position, domeTransform.position);

        if (distance > attackRange)
        {
            MoveTowardDome();
        }
        else
        {
            AttackDome();
        }
    }

    private void MoveTowardDome()
    {
        Vector2 direction = (domeTransform.position - transform.position).normalized;
        transform.Translate(direction * moveSpeed * Time.deltaTime, Space.World);
    }

    private void AttackDome()
    {
        attackTimer -= Time.deltaTime;
        if (attackTimer > 0f) return;

        domeHealth?.TakeDamage(damagePerHit);
        attackTimer = attackInterval;
    }
}
