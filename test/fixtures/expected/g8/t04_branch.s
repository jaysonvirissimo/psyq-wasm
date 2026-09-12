	.file	1 "t04_branch.c"
gcc2_compiled.:
__gnu_compiled_c:
	.text
	.align	2
	.globl	max_
	.align	2
	.globl	umax
	.align	2
	.globl	sign
	.align	2
	.globl	classify
	.align	2
	.globl	cmp_s
	.align	2
	.globl	cmp_u
	.align	2
	.globl	cmp_sk
	.align	2
	.globl	cmp_uk
	.align	2
	.globl	cmp_ge
	.align	2
	.globl	cmp_uge

	.text
	.text
	.ent	max_
max_:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	move	$2,$4
	slt	$3,$5,$2
	bne	$3,$0,$L4
	move	$2,$5
$L4:
	j	$31
	.end	max_
	.text
	.ent	umax
umax:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	sltu	$2,$5,$4
	beq	$2,$0,$L6
	move	$5,$4
$L6:
	.set	noreorder
	.set	nomacro
	j	$31
	move	$2,$5
	.set	macro
	.set	reorder

	.end	umax
	.text
	.ent	sign
sign:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.set	noreorder
	.set	nomacro
	bltz	$4,$L12
	li	$2,-1			# 0xffffffff
	.set	macro
	.set	reorder

	slt	$2,$0,$4
$L12:
	j	$31
	.end	sign
	.text
	.ent	classify
classify:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	sltu	$2,$4,7
	.set	noreorder
	.set	nomacro
	beq	$2,$0,$L22
	lui	$2,%hi($L23) # high
	.set	macro
	.set	reorder

	addiu	$2,$2,%lo($L23) # low
	sll	$3,$4,2
	addu	$3,$3,$2
	lw	$2,0($3)
	#nop
	j	$2
	.rdata
	.align	3
$L23:
	.word	$L15
	.word	$L16
	.word	$L17
	.word	$L18
	.word	$L19
	.word	$L20
	.word	$L21
	.text
$L15:
	.set	noreorder
	.set	nomacro
	j	$31
	li	$2,10			# 0x0000000a
	.set	macro
	.set	reorder

$L16:
	.set	noreorder
	.set	nomacro
	j	$31
	li	$2,20			# 0x00000014
	.set	macro
	.set	reorder

$L17:
	.set	noreorder
	.set	nomacro
	j	$31
	li	$2,30			# 0x0000001e
	.set	macro
	.set	reorder

$L18:
	.set	noreorder
	.set	nomacro
	j	$31
	li	$2,45			# 0x0000002d
	.set	macro
	.set	reorder

$L19:
	.set	noreorder
	.set	nomacro
	j	$31
	li	$2,50			# 0x00000032
	.set	macro
	.set	reorder

$L20:
	.set	noreorder
	.set	nomacro
	j	$31
	li	$2,65			# 0x00000041
	.set	macro
	.set	reorder

$L21:
	.set	noreorder
	.set	nomacro
	j	$31
	li	$2,70			# 0x00000046
	.set	macro
	.set	reorder

$L22:
	.set	noreorder
	.set	nomacro
	j	$31
	li	$2,-1			# 0xffffffff
	.set	macro
	.set	reorder

	.end	classify
	.text
	.ent	cmp_s
cmp_s:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.set	noreorder
	.set	nomacro
	j	$31
	slt	$2,$4,$5
	.set	macro
	.set	reorder

	.end	cmp_s
	.text
	.ent	cmp_u
cmp_u:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.set	noreorder
	.set	nomacro
	j	$31
	sltu	$2,$4,$5
	.set	macro
	.set	reorder

	.end	cmp_u
	.text
	.ent	cmp_sk
cmp_sk:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.set	noreorder
	.set	nomacro
	j	$31
	slt	$2,$4,100
	.set	macro
	.set	reorder

	.end	cmp_sk
	.text
	.ent	cmp_uk
cmp_uk:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.set	noreorder
	.set	nomacro
	j	$31
	sltu	$2,$4,100
	.set	macro
	.set	reorder

	.end	cmp_uk
	.text
	.ent	cmp_ge
cmp_ge:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	slt	$2,$4,$5
	.set	noreorder
	.set	nomacro
	j	$31
	xori	$2,$2,0x0001
	.set	macro
	.set	reorder

	.end	cmp_ge
	.text
	.ent	cmp_uge
cmp_uge:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	sltu	$2,$4,$5
	.set	noreorder
	.set	nomacro
	j	$31
	xori	$2,$2,0x0001
	.set	macro
	.set	reorder

	.end	cmp_uge
