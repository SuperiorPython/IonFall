using UnityEngine;

/// <summary>
/// A simple projectile that travels in a straight line and deals damage on contact.
/// Attach to the projectile prefab, which should have a Rigidbody2D (kinematic or dynamic)
/// and a Collider2D set to "Is Trigger".
/// </summary>
public class Projectile : MonoBehaviour
{
    [Header("Movement")]
    [SerializeField] private float speed = 15f;
    [SerializeField] private float lifetime = 3f; // safety cleanup if it never hits anything

    [Header("Combat")]
    [SerializeField] private float damage = 10f;

    [Header("References")]
    [SerializeField] private PlayAreaBounds playAreaBounds; // optional — leave empty to disable the despawn check

    private Vector2 direction;

    private void Start()
    {
        Destroy(gameObject, lifetime);
    }

    /// <summary>
    /// Called by TurretShoot right after Instantiate to set travel direction.
    /// </summary>
    public void SetDirection(Vector2 dir)
    {
        direction = dir.normalized;
    }

    private void Update()
    {
        transform.Translate(direction * speed * Time.deltaTime, Space.World);

        if (playAreaBounds != null && playAreaBounds.IsOutside(transform.position))
        {
            Destroy(gameObject);
        }
    }

    private void OnTriggerEnter2D(Collider2D other)
    {
        // Detect enemies by component rather than a layer mask — simpler and
        // avoids a silent no-op if a layer was never configured in the Inspector.
        var enemyHealth = other.GetComponent<EnemyHealth>();
        if (enemyHealth == null) return; // not an enemy (dome, other projectiles, etc.) — ignore

        enemyHealth.TakeDamage(damage);
        Destroy(gameObject);
    }
}
